import os

def search_files(directory):
    print(f"Searching in: {directory}")
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.lower().endswith(('.pdf', '.xlsx', '.xls', '.xml')):
                full_path = os.path.join(root, file)
                size = os.path.getsize(full_path)
                print(f"  {file} ({size} bytes) - {full_path}")

search_files("/Volumes/ARXIUS/jordibonilla/Documents Jordi Bonilla/PERSONAL/HEMIÒLIA")
