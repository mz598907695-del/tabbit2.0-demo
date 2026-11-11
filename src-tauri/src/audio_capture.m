// Core Audio's private, unmuted process tap. No file recording, microphone,
// screen capture, playback routing, or system-volume mutation takes place here.
#import <Foundation/Foundation.h>
#import <CoreAudio/CoreAudio.h>
#import <CoreAudio/AudioHardwareTapping.h>
#import <CoreAudio/CATapDescription.h>
#import <AudioToolbox/AudioHardwareService.h>
#include <math.h>
#include <pthread.h>
#include <string.h>
#include "audio_capture.h"

static AudioObjectID tap_id = kAudioObjectUnknown;
static AudioObjectID aggregate_id = kAudioObjectUnknown;
static AudioDeviceIOProcID io_proc = NULL;
static AudioStreamBasicDescription tap_format;
static pthread_mutex_t frame_lock = PTHREAD_MUTEX_INITIALIZER;
static TBAudioFrame latest_frame;
// Only the Core Audio IO thread touches these ring buffers while running.
static float left_ring[TB_AUDIO_SAMPLES], right_ring[TB_AUDIO_SAMPLES];
static uint32_t ring_offset = 0, ring_count = 0;
static uint64_t frame_sequence = 0;

static AudioObjectPropertyAddress address(AudioObjectPropertySelector selector,
                                          AudioObjectPropertyScope scope,
                                          AudioObjectPropertyElement element) {
    return (AudioObjectPropertyAddress){selector, scope, element};
}

static OSStatus read_property(AudioObjectID object, AudioObjectPropertySelector selector,
                              AudioObjectPropertyScope scope, AudioObjectPropertyElement element,
                              void *data, UInt32 size) {
    AudioObjectPropertyAddress property = address(selector, scope, element);
    if (!AudioObjectHasProperty(object, &property)) return kAudioHardwareUnknownPropertyError;
    return AudioObjectGetPropertyData(object, &property, 0, NULL, &size, data);
}

int32_t tb_audio_supported(void) {
    if (@available(macOS 14.2, *)) return 1;
    return 0;
}

int32_t tb_audio_output(TBAudioOutput *output) {
    if (!output) return kAudioHardwareIllegalOperationError;
    memset(output, 0, sizeof(*output));
    OSStatus status = read_property(kAudioObjectSystemObject, kAudioHardwarePropertyDefaultOutputDevice,
                                   kAudioObjectPropertyScopeGlobal, kAudioObjectPropertyElementMain,
                                   &output->device_id, sizeof(output->device_id));
    if (status != noErr || output->device_id == kAudioObjectUnknown) return status ?: kAudioHardwareBadDeviceError;
    CFStringRef name = NULL;
    if (read_property(output->device_id, kAudioObjectPropertyName, kAudioObjectPropertyScopeGlobal,
                      kAudioObjectPropertyElementMain, &name, sizeof(name)) == noErr && name) {
        CFStringGetCString(name, output->device_name, sizeof(output->device_name), kCFStringEncodingUTF8);
        CFRelease(name);
    }
    Float32 volume = 0;
    AudioObjectPropertyAddress virtual_volume = address(kAudioHardwareServiceDeviceProperty_VirtualMainVolume,
                                                       kAudioDevicePropertyScopeOutput, kAudioObjectPropertyElementMain);
    UInt32 size = sizeof(volume);
    if (AudioHardwareServiceHasProperty(output->device_id, &virtual_volume)
        && AudioHardwareServiceGetPropertyData(output->device_id, &virtual_volume, 0, NULL, &size, &volume) == noErr) {
        output->volume_known = isfinite(volume);
    } else if (read_property(output->device_id, kAudioDevicePropertyVolumeScalar, kAudioDevicePropertyScopeOutput,
                            kAudioObjectPropertyElementMain, &volume, sizeof(volume)) == noErr) {
        output->volume_known = isfinite(volume);
    } else {
        UInt32 channels[2] = {1, 2};
        read_property(output->device_id, kAudioDevicePropertyPreferredChannelsForStereo, kAudioDevicePropertyScopeOutput,
                      kAudioObjectPropertyElementMain, channels, sizeof(channels));
        Float32 sum = 0; unsigned known = 0;
        for (unsigned i = 0; i < 2; i++) {
            Float32 value = 0;
            if (read_property(output->device_id, kAudioDevicePropertyVolumeScalar, kAudioDevicePropertyScopeOutput,
                              channels[i], &value, sizeof(value)) == noErr && isfinite(value)) { sum += value; known++; }
        }
        if (known) { volume = sum / known; output->volume_known = 1; }
    }
    output->volume = fminf(1, fmaxf(0, volume));
    UInt32 muted = 0;
    if (read_property(output->device_id, kAudioDevicePropertyMute, kAudioDevicePropertyScopeOutput,
                      kAudioObjectPropertyElementMain, &muted, sizeof(muted)) == noErr) {
        output->mute_known = 1; output->muted = muted != 0;
    } else {
        // Some interfaces expose only per-channel mute. Unknown remains unknown.
        unsigned known = 0, all_muted = 1;
        for (unsigned channel = 1; channel <= 2; channel++) {
            if (read_property(output->device_id, kAudioDevicePropertyMute, kAudioDevicePropertyScopeOutput,
                              channel, &muted, sizeof(muted)) == noErr) { known++; all_muted &= muted != 0; }
        }
        if (known) { output->mute_known = 1; output->muted = all_muted; }
    }
    return noErr;
}

static OSStatus capture_io(AudioObjectID device, const AudioTimeStamp *now,
                           const AudioBufferList *input, const AudioTimeStamp *input_time,
                           AudioBufferList *output, const AudioTimeStamp *output_time, void *context) {
    (void)device; (void)now; (void)input_time; (void)output_time; (void)context;
    // A private tap-only aggregate has no audible output. Never feed captured
    // samples back into the output device (which would cause feedback).
    if (output) for (UInt32 b = 0; b < output->mNumberBuffers; b++) {
        if (output->mBuffers[b].mData) memset(output->mBuffers[b].mData, 0, output->mBuffers[b].mDataByteSize);
    }
    if (!input || input->mNumberBuffers == 0) return noErr;
    const AudioBuffer *first = &input->mBuffers[0];
    if (!first->mData || !first->mNumberChannels) return noErr;
    UInt32 frames = first->mDataByteSize / sizeof(Float32) / first->mNumberChannels;
    if (!frames) return noErr;
    const Float32 *left = first->mData, *right = left;
    UInt32 left_stride = first->mNumberChannels, right_stride = left_stride;
    if (first->mNumberChannels >= 2) right = left + 1;
    else if (input->mNumberBuffers >= 2 && input->mBuffers[1].mData && input->mBuffers[1].mNumberChannels) {
        const AudioBuffer *second = &input->mBuffers[1];
        right = second->mData; right_stride = second->mNumberChannels;
        frames = MIN(frames, second->mDataByteSize / sizeof(Float32) / right_stride);
    }
    double squares = 0; float peak = 0;
    for (UInt32 i = 0; i < frames; i++) {
        float l = left[i * left_stride], r = right[i * right_stride];
        if (!isfinite(l)) l = 0; if (!isfinite(r)) r = 0;
        left_ring[ring_offset] = l; right_ring[ring_offset] = r;
        ring_offset = (ring_offset + 1) % TB_AUDIO_SAMPLES;
        if (ring_count < TB_AUDIO_SAMPLES) ring_count++;
        squares += ((double)l * l + (double)r * r) * 0.5;
        peak = fmaxf(peak, fmaxf(fabsf(l), fabsf(r)));
    }
    // The real-time thread never waits on a UI sampler or allocates memory.
    if (pthread_mutex_trylock(&frame_lock) == 0) {
        latest_frame.sequence = ++frame_sequence;
        latest_frame.sample_rate = tap_format.mSampleRate;
        latest_frame.channels = tap_format.mChannelsPerFrame;
        latest_frame.sample_count = ring_count;
        latest_frame.rms = sqrt(squares / frames);
        latest_frame.peak = peak;
        for (UInt32 i = 0; i < TB_AUDIO_SAMPLES; i++) {
            // Zero-padding precedes the first complete 1024-sample window.
            UInt32 index = (ring_offset + i) % TB_AUDIO_SAMPLES;
            latest_frame.left[i] = left_ring[index]; latest_frame.right[i] = right_ring[index];
        }
        pthread_mutex_unlock(&frame_lock);
    }
    return noErr;
}

void tb_audio_stop(void) {
    if (aggregate_id != kAudioObjectUnknown && io_proc) {
        AudioDeviceStop(aggregate_id, io_proc);
        AudioDeviceDestroyIOProcID(aggregate_id, io_proc);
    }
    io_proc = NULL;
    if (aggregate_id != kAudioObjectUnknown) AudioHardwareDestroyAggregateDevice(aggregate_id);
    aggregate_id = kAudioObjectUnknown;
    if (@available(macOS 14.2, *)) {
        if (tap_id != kAudioObjectUnknown) AudioHardwareDestroyProcessTap(tap_id);
    }
    tap_id = kAudioObjectUnknown;
    pthread_mutex_lock(&frame_lock);
    memset(&latest_frame, 0, sizeof(latest_frame));
    pthread_mutex_unlock(&frame_lock);
    memset(left_ring, 0, sizeof(left_ring)); memset(right_ring, 0, sizeof(right_ring));
    ring_offset = 0; ring_count = 0; frame_sequence = 0;
}

int32_t tb_audio_start(void) {
    if (io_proc) return noErr;
    if (@available(macOS 14.2, *)) {
        @autoreleasepool {
            memset(left_ring, 0, sizeof(left_ring)); memset(right_ring, 0, sizeof(right_ring));
            ring_offset = 0; ring_count = 0; frame_sequence = 0;
            CATapDescription *description = [[CATapDescription alloc] initStereoGlobalTapButExcludeProcesses:@[]];
            description.UUID = NSUUID.UUID;
            description.name = @"Tabbit audio visualizer";
            description.privateTap = YES;
            description.muteBehavior = CATapUnmuted;
            OSStatus status = AudioHardwareCreateProcessTap(description, &tap_id);
            if (status != noErr) { tb_audio_stop(); return status; }
            status = read_property(tap_id, kAudioTapPropertyFormat, kAudioObjectPropertyScopeGlobal,
                                   kAudioObjectPropertyElementMain, &tap_format, sizeof(tap_format));
            if (status != noErr) { tb_audio_stop(); return status; }
            if (tap_format.mFormatID != kAudioFormatLinearPCM || !(tap_format.mFormatFlags & kAudioFormatFlagIsFloat)
                || tap_format.mBitsPerChannel != 32 || !tap_format.mChannelsPerFrame || tap_format.mSampleRate <= 0
                || (tap_format.mFormatFlags & kAudioFormatFlagIsBigEndian)) {
                tb_audio_stop(); return -10002;
            }
            NSDictionary *aggregate = @{
                @kAudioAggregateDeviceNameKey: @"Tabbit private audio visualizer",
                @kAudioAggregateDeviceUIDKey: [@"com.tabbit.demo.audio." stringByAppendingString:NSUUID.UUID.UUIDString],
                @kAudioAggregateDeviceIsPrivateKey: @YES,
                @kAudioAggregateDeviceIsStackedKey: @NO,
                @kAudioAggregateDeviceTapAutoStartKey: @YES,
                @kAudioAggregateDeviceTapListKey: @[@{
                    @kAudioSubTapUIDKey: description.UUID.UUIDString,
                    @kAudioSubTapDriftCompensationKey: @YES
                }]
            };
            status = AudioHardwareCreateAggregateDevice((__bridge CFDictionaryRef)aggregate, &aggregate_id);
            if (status != noErr) { tb_audio_stop(); return status; }
            status = AudioDeviceCreateIOProcID(aggregate_id, capture_io, NULL, &io_proc);
            if (status != noErr) { tb_audio_stop(); return status; }
            // This is the only operation that can request system-audio access.
            status = AudioDeviceStart(aggregate_id, io_proc);
            if (status != noErr) { tb_audio_stop(); return status; }
            return noErr;
        }
    }
    return -10001;
}

int32_t tb_audio_sample(TBAudioFrame *frame) {
    if (!frame) return kAudioHardwareIllegalOperationError;
    pthread_mutex_lock(&frame_lock);
    memcpy(frame, &latest_frame, sizeof(*frame));
    pthread_mutex_unlock(&frame_lock);
    return io_proc ? 1 : 0;
}
