# /// script
# requires-python = ">=3.9"
# dependencies = [
#     "PyMuPDF",
#     "pyzbar",
#     "Pillow",
# ]
# ///
import fitz
from pyzbar.pyzbar import decode
from PIL import Image
import os
import sys

def read_qr_from_file(filepath):
    qrs = []
    if filepath.lower().endswith(".pdf"):
        doc = fitz.open(filepath)
        for page in doc:
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            decoded = decode(img)
            for d in decoded:
                qrs.append(d.data.decode('utf-8'))
    elif filepath.lower().endswith((".png", ".jpg", ".jpeg")):
        img = Image.open(filepath)
        decoded = decode(img)
        for d in decoded:
            qrs.append(d.data.decode('utf-8'))
    return qrs

directory = "/Users/hemiolia/Desktop/FACTURES VERIFACTU"
for file in os.listdir(directory):
    if file.startswith('.'): continue
    path = os.path.join(directory, file)
    print(f"Reading {file}...")
    qrs = read_qr_from_file(path)
    for q in qrs:
        print(f"  Found QR: {q}")
