#!/usr/bin/env ruby
# Ruby AI Agent - CLI Tool
# Accepts natural language prompts and executes Ruby code

require 'json'
require 'net/http'
require 'uri'

OLLAMA_HOST = ENV.fetch('OLLAMA_HOST', 'http://localhost:11434')
OLLAMA_MODEL = ENV.fetch('OLLAMA_MODEL', 'qwen2.5-coder:3b')
GEMINI_API_KEY = ENV['GEMINI_API_KEY']

$stderr.puts "[Agent] Starting Ruby AI Agent"

def call_ollama(prompt)
  uri = URI("#{OLLAMA_HOST}/api/chat")
  req = Net::HTTP::Post.new(uri)
  req['Content-Type'] = 'application/json'
  req.body = {
    model: OLLAMA_MODEL,
    messages: [{ role: 'user', content: prompt }],
    stream: false
  }.to_json

  client = Net::HTTP.new(uri.hostname, uri.port)
  client.open_timeout = 120
  client.read_timeout = 120
  response = client.request(req)
  result = JSON.parse(response.body)
  result.dig('message', 'content')
rescue => e
  $stderr.puts "[Ollama Error] #{e.message}"
  nil
end

def call_gemini(prompt)
  return nil if GEMINI_API_KEY.nil? || GEMINI_API_KEY.empty?

  uri = URI("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=#{GEMINI_API_KEY}")
  req = Net::HTTP::Post.new(uri)
  req['Content-Type'] = 'application/json'
  req.body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
  }.to_json

  response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) { |h| h.request(req) }
  result = JSON.parse(response.body)
  result.dig('candidates', 0, 'content', 'parts', 0, 'text')
rescue => e
  $stderr.puts "[Gemini Error] #{e.message}"
  nil
end

def generate_code(prompt)
  full_prompt = <<~PROMPT
    You are an expert Ruby programmer. Generate ONLY Ruby code for this request:

    #{prompt}

    RULES:
    - Output ONLY Ruby code, nothing else
    - NO explanations, NO comments describing what the code does
    - NO markdown formatting, NO backticks, NO code block markers
    - Code must be valid Ruby syntax
    - Code must be complete and runnable
    - Use Ruby's built-in methods and standard library
    - For output use: puts, print

    Output just the raw Ruby code now:
  PROMPT

  # Try Ollama first
  result = call_ollama(full_prompt)
  return clean_code(result) if result && !result.empty?

  # Fallback to Gemini
  result = call_gemini(full_prompt)
  return clean_code(result) if result && !result.empty?

  raise 'No LLM available - configure OLLAMA_HOST or GEMINI_API_KEY'
end

def clean_code(raw)
  return '' if raw.nil? || raw.empty?

  code = raw.dup
  code.gsub!(/```ruby/, '')
  code.gsub!(/```ruby/, '')
  code.gsub!(/```\n?/, '')
  code.gsub!(/`/, '')
  code.strip
end

def execute_code(code)
  require 'tempfile'
  
  tmp = Tempfile.new(['agent_', '.rb'])
  begin
    tmp.write(code)
    tmp.close
    
    output = `ruby #{tmp.path} 2>&1`
    exit_code = $?.exitstatus
    [output, '', exit_code]
  ensure
    tmp.unlink
  end
end

def show_help
  puts <<~HELP
    Ruby AI Agent - Generate and execute Ruby code using AI

    Usage: agent.rb <prompt>
           agent.rb --test

    Examples:
      agent.rb "Print hello world 10 times"
      agent.rb "Read a file and count its lines"
      agent.rb --test

    Environment Variables:
      OLLAMA_HOST      Ollama server URL (default: http://localhost:11434)
      OLLAMA_MODEL     Model to use (default: qwen2.5-coder:3b)
      GEMINI_API_KEY   Google Gemini API key (optional)
  HELP
end

def test_llm
  $stderr.puts '[Agent] Testing LLM connectivity...'

  if call_ollama('Say "Hello" in exactly one word')
    $stderr.puts '[Agent] Ollama connection: OK'
  else
    $stderr.puts '[Error] Ollama connection: FAILED'
  end

  if GEMINI_API_KEY && !GEMINI_API_KEY.empty?
    if call_gemini('Say "Hello" in exactly one word')
      $stderr.puts '[Agent] Gemini connection: OK'
    else
      $stderr.puts '[Error] Gemini connection: FAILED'
    end
  else
    $stderr.puts '[Agent] Gemini: Not configured'
  end
end

if __FILE__ == $PROGRAM_NAME
  if ARGV.empty?
    show_help
    exit 1
  end

  if ARGV[0] == '--test'
    test_llm
    exit 0
  end

  prompt = ARGV.join(' ')
  $stderr.puts "[Agent] Generating code for: #{prompt}"

  begin
    code = generate_code(prompt)
    $stderr.puts "[Agent] Generated #{code.length} chars of code"

    stdout, _stderr, exit_code = execute_code(code)

    print stdout
    exit exit_code
  rescue => e
    $stderr.puts "[Agent Error] #{e.message}"
    exit 1
  end
end
