import ollama

def chat(model: str, prompt: str, message: str):
    return ollama.chat(
        model=model,
        messages=[
            {
                "role": "system",
                "content": prompt
            },
            {
                "role": "user",
                "content": message
            }
        ]
    )