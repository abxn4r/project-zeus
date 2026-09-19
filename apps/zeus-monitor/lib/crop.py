import sys
import os

try:
    from PIL import Image
except ImportError:
    print("[ERROR] Pillow library not installed. Please run: pip install pillow")
    sys.exit(1)

def crop_image(src_path, dest_path, left, top, right, bottom):
    if not os.path.exists(src_path):
        print(f"[ERROR] Source file does not exist: {src_path}")
        sys.exit(1)
        
    try:
        img = Image.open(src_path)
        # crop expects a tuple (left, upper, right, lower)
        cropped = img.crop((left, top, right, bottom))
        cropped.save(dest_path)
        print(f"[SUCCESS] Cropped image saved to {dest_path}")
    except Exception as e:
        print(f"[ERROR] Cropping failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 7:
        print("Usage: python crop.py <src> <dest> <left> <top> <right> <bottom>")
        sys.exit(1)
        
    src = sys.argv[1]
    dest = sys.argv[2]
    try:
        l = int(sys.argv[3])
        t = int(sys.argv[4])
        r = int(sys.argv[5])
        b = int(sys.argv[6])
    except ValueError:
        print("[ERROR] Bounds must be integers")
        sys.exit(1)
        
    crop_image(src, dest, l, t, r, b)
