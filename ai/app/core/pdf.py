import pymupdf4llm

def pdf_to_markdown(path):
    return pymupdf4llm.to_markdown(path)