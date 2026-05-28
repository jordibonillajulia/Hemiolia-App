import os

def search_files(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            full_path = os.path.join(root, file)
            if "2026" in full_path:
                size = os.path.getsize(full_path)
                print(f"  {file} ({size} bytes) - {full_path}")

search_files("/Volumes/ARXIUS/jordibonilla/Documents Jordi Bonilla/PERSONAL/HEMIÒLIA/FACTURES")
