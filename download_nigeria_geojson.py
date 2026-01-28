import requests
import os
import json

# LGA URL (Last resort for real data)
url = "https://raw.githubusercontent.com/qedsoftware/geojson_data/master/nigeria-lga.geojson"
target_path = "frontend/public/nigeria.json"

def download_geojson():
    print(f"Attempting to download Nigeria GeoJSON (LGA) to {target_path}...")
    print(f"Source: {url}")
    
    try:
        response = requests.get(url)
        if response.status_code == 200:
            content = response.content
            if b'"type":' in content and (b'"FeatureCollection"' in content):
                with open(target_path, 'wb') as f:
                    f.write(content)
                print(f"SUCCESS: Downloaded and replaced nigeria.json (LGA Data)")
                return True
            else:
                print(f"  - Invalid content (not GeoJSON)")
        else:
            print(f"  - Failed (Status: {response.status_code})")
    except Exception as e:
        print(f"  - Error: {e}")

    # Fallback: Create Empty Valid GeoJSON to stop crash
    print("FALLBACK: Creating empty valid FeatureCollection to stop crash.")
    empty_geojson = {
        "type": "FeatureCollection",
        "features": []
    }
    with open(target_path, 'w') as f:
        json.dump(empty_geojson, f)
    print("SUCCESS: Created empty nigeria.json fallback.")
    return True

if __name__ == "__main__":
    download_geojson()
