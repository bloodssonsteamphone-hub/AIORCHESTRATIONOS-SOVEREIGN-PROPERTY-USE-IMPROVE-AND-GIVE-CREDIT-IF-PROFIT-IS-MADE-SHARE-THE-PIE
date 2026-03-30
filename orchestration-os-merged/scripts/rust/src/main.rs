//! Rust AI Agent - CLI Tool
//! Accepts natural language prompts and generates/executes Rust code

use std::env;
use std::process::{Command, Stdio};

use serde::Deserialize;

const OLLAMA_HOST: &str = "http://localhost:11434";
const OLLAMA_MODEL: &str = "qwen2.5-coder:3b";

#[derive(Debug, Deserialize)]
struct OllamaResponse {
    message: Option<Message>,
}

#[derive(Debug, Deserialize)]
struct Message {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GeminiResponse {
    candidates: Option<Vec<Candidate>>,
}

#[derive(Debug, Deserialize)]
struct Candidate {
    content: Option<Content>,
}

#[derive(Debug, Deserialize)]
struct Content {
    parts: Option<Vec<Part>>,
}

#[derive(Debug, Deserialize)]
struct Part {
    text: Option<String>,
}

fn log_info(msg: &str) {
    eprintln!("\x1b[0;32m[Agent]\x1b[0m {}", msg);
}

fn log_error(msg: &str) {
    eprintln!("\x1b[0;31m[Error]\x1b[0m {}", msg);
}

fn log_warn(msg: &str) {
    eprintln!("\x1b[0;33m[Warn]\x1b[0m {}", msg);
}

fn call_ollama(prompt: &str) -> Option<String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .ok()?;

    let body = serde_json::json!({
        "model": OLLAMA_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": false
    });

    let res = client
        .post(format!("{}/api/chat", OLLAMA_HOST))
        .json(&body)
        .send()
        .ok()?;

    let json: OllamaResponse = res.json().ok()?;
    json.message?.content
}

fn call_gemini(prompt: &str) -> Option<String> {
    let api_key = env::var("GEMINI_API_KEY").ok()?;
    if api_key.is_empty() {
        return None;
    }

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .ok()?;

    let body = serde_json::json!({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 8192}
    });

    let res = client
        .post(format!(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={}",
            api_key
        ))
        .json(&body)
        .send()
        .ok()?;

    let json: GeminiResponse = res.json().ok()?;
    json.candidates?.first()?.content.as_ref()?.parts.first()?.text.clone()
}

fn clean_code(raw: &str) -> String {
    raw.replace(|c: char| c == '`' || c == '\u{60}', "")
        .replace("```rust", "")
        .replace("```rs", "")
        .replace("```toml", "")
        .replace("```toml", "")
        .replace("```bash", "")
        .replace("```sh", "")
        .replace("```", "")
        .trim()
        .to_string()
}

fn generate_code(prompt: &str) -> Option<String> {
    let full_prompt = format!(
        "Generate ONLY Rust code for: {}\n\nRules:\n- Output ONLY the code, no explanations\n- No markdown code blocks\n- Code must be valid Rust\n- Include proper use statements\n- No bash commands or shell script",
        prompt
    );

    let result = call_ollama(&full_prompt).or_else(|| call_gemini(&full_prompt))?;
    Some(clean_code(&result))
}

fn execute_code(code: &str) -> (String, i32) {
    let output_dir = env::var("OUTPUT_DIR").unwrap_or_else(|_| "/tmp".to_string());
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();

    let tmp_rs = format!("{}/agent_{}.rs", output_dir, timestamp);
    let tmp_project = format!("{}/agent_project_{}", output_dir, timestamp);

    // Write to temp file
    if let Err(e) = std::fs::write(&tmp_rs, code) {
        return (format!("Failed to write temp file: {}", e), 1);
    }

    let _cleanup = Cleanup {
        paths: vec![tmp_rs.clone(), tmp_project.clone()],
    };

    // Create cargo project
    let _ = std::fs::create_dir_all(format!("{}/src", tmp_project));
    let _ = std::fs::write(format!("{}/src/main.rs", tmp_project), code);
    let _ = std::fs::write(
        format!("{}/Cargo.toml", tmp_project),
        r#"[package]
name = "agent-project"
version = "0.1.0"
edition = "2021"
"#
    );

    let out = Command::new("cargo")
        .args(["run", "--manifest-path", &format!("{}/Cargo.toml", tmp_project)])
        .current_dir(&tmp_project)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output();

    match out {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let stderr = String::from_utf8_lossy(&out.stderr);
            let exit_code = out.status.code().unwrap_or(1);

            if exit_code == 0 {
                (stdout.to_string(), 0)
            } else {
                (format!("{}\n{}", stdout, stderr), exit_code)
            }
        }
        Err(e) => (format!("Execution failed: {}", e), 1),
    }
}

struct Cleanup { paths: Vec<String> }

impl Drop for Cleanup {
    fn drop(&mut self) {
        for p in &self.paths {
            let _ = std::fs::remove_file(p);
            let _ = std::fs::remove_dir_all(p);
        }
    }
}

fn test_connection() {
    log_info("Testing LLM connectivity...");

    if let Some(result) = call_ollama("Say \"OK\" in exactly one word") {
        if result.to_lowercase().contains("ok") {
            log_info("Ollama connection: OK");
            return;
        }
    }
    log_error("Ollama connection: FAILED");

    if let Ok(api_key) = env::var("GEMINI_API_KEY") {
        if !api_key.is_empty() {
            if let Some(result) = call_gemini("Say \"OK\" in exactly one word") {
                if result.to_lowercase().contains("ok") {
                    log_info("Gemini connection: OK");
                    return;
                }
            }
            log_error("Gemini connection: FAILED");
        } else {
            log_info("Gemini: Not configured");
        }
    } else {
        log_info("Gemini: Not configured");
    }
}

fn show_help() {
    println!(
        "Rust AI Agent - Generate and execute Rust code using AI

Usage: cargo run -- <prompt>
       cargo run -- --test

Environment Variables:
  OLLAMA_HOST      Ollama server URL (default: http://localhost:11434)
  OLLAMA_MODEL     Model to use (default: qwen2.5-coder:3b)
  GEMINI_API_KEY   Google Gemini API key (optional)
  OUTPUT_DIR       Temp directory for code execution (default: /tmp)
"
    );
}

fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() < 2 {
        show_help();
        std::process::exit(1);
    }

    match args[1].as_str() {
        "--test" => {
            test_connection();
        }
        "--help" | "-h" => {
            show_help();
        }
        prompt => {
            let prompt = if prompt.starts_with("--") {
                args[1..].join(" ")
            } else {
                args[1..].join(" ")
            };

            log_info(&format!("Generating code for: {}", prompt));

            let code = match generate_code(&prompt) {
                Some(c) => c,
                None => {
                    log_error("No LLM available and no code generated");
                    std::process::exit(1);
                }
            };

            log_info(&format!("Generated {} lines of code", code.lines().count()));
            println!("\n--- Generated Code ---\n{}\n--- End Code ---\n", code);

            log_info("Executing...");
            let (output, exit_code) = execute_code(&code);

            println!("{}", output);
            std::process::exit(exit_code);
        }
    }
}
