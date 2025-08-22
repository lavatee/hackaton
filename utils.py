from io import BytesIO

from PIL import Image
import pytesseract
import hashlib
import time


def exectime(func):
    def wrapper(*args, **kwargs):
        start_time = time.time()
        retval = func(*args, **kwargs)
        print(f"{func.__name__} took {time.time() - start_time}s")
        return retval

    return wrapper


@exectime
def preprocess(file):
    try:
        if hasattr(file, 'read'):
            img = Image.open(file)
        else:
            img = Image.open(BytesIO(file))

        img = img.resize((img.size[0] * 2, img.size[1] * 2), Image.LANCZOS)
        return img
    except Exception as e:
        raise ValueError(f"Error processing image: {str(e)}")


@exectime
def ocr(img):
    return pytesseract.image_to_string(img, config="--oem 2 --psm 12", lang="rus")


@exectime
def hash_file(file):
    sha256 = hashlib.sha256()

    if hasattr(file, 'read'):
        file.seek(0)
        for chunk in iter(lambda: file.read(4096), b""):
            sha256.update(chunk)
        file.seek(0)
    else:
        sha256.update(file)

    return sha256.hexdigest()
