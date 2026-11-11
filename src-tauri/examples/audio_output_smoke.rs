// Read-only hardware query: deliberately never starts a tap or requests access.
fn main() {
    println!("{}", serde_json::to_string_pretty(&tabbit_2_demo_lib::audio_visualizer::read_output_status()).unwrap());
}
