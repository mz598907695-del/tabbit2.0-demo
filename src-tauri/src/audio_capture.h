#ifndef TABBIT_AUDIO_CAPTURE_H
#define TABBIT_AUDIO_CAPTURE_H
#include <stdint.h>
#define TB_AUDIO_SAMPLES 1024
typedef struct {
    uint64_t sequence;
    double sample_rate;
    uint32_t sample_count;
    uint32_t channels;
    float rms;
    float peak;
    float left[TB_AUDIO_SAMPLES];
    float right[TB_AUDIO_SAMPLES];
} TBAudioFrame;
typedef struct {
    uint32_t device_id;
    int32_t volume_known;
    int32_t mute_known;
    int32_t muted;
    float volume;
    char device_name[256];
} TBAudioOutput;
int32_t tb_audio_supported(void);
int32_t tb_audio_output(TBAudioOutput *output);
int32_t tb_audio_start(void);
void tb_audio_stop(void);
int32_t tb_audio_sample(TBAudioFrame *frame);
#endif
