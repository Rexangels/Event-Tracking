import json
import math

def simplify_points(points, tolerance):
    if len(points) < 3:
        return points

    # Douglas-Peucker algorithm
    dmax = 0
    index = 0
    end = len(points) - 1

    for i in range(1, end):
        d = perpendicular_distance(points[i], points[0], points[end])
        if d > dmax:
            index = i
            dmax = d

    if dmax > tolerance:
        rec_results1 = simplify_points(points[:index+1], tolerance)
        rec_results2 = simplify_points(points[index:], tolerance)
        return rec_results1[:-1] + rec_results2
    else:
        return [points[0], points[end]]

def perpendicular_distance(point, start, end):
    if start == end:
        return math.sqrt((point[0] - start[0])**2 + (point[1] - start[1])**2)
    
    n = abs((end[1] - start[1]) * point[0] - (end[0] - start[0]) * point[1] + end[0] * start[1] - end[1] * start[0])
    d = math.sqrt((end[1] - start[1])**2 + (end[0] - start[0])**2)
    return n / d

def simplify_geometry(geometry, tolerance):
    if geometry['type'] == 'Polygon':
        return {
            'type': 'Polygon',
            'coordinates': [simplify_points(ring, tolerance) for ring in geometry['coordinates']]
        }
    elif geometry['type'] == 'MultiPolygon':
        return {
            'type': 'MultiPolygon',
            'coordinates': [[simplify_points(ring, tolerance) for ring in polygon] for polygon in geometry['coordinates']]
        }
    return geometry

def main():
    input_path = r"c:\Users\danie\OneDrive\Desktop\Event_Tracking _APP\Event-Tracking\frontend\public\nigeria.json"
    output_path = r"c:\Users\danie\OneDrive\Desktop\Event_Tracking _APP\Event-Tracking\frontend\public\nigeria_optimized.json"
    
    # Tolerance roughly in degrees. 0.01 is approx 1km. 
    # For a country view, we can probably go higher.
    # Let's try 0.005 first.
    tolerance = 0.005 

    print(f"Reading {input_path}...")
    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print("Simplifying...")
    total_features = len(data['features'])
    for i, feature in enumerate(data['features']):
        if feature['geometry']:
            feature['geometry'] = simplify_geometry(feature['geometry'], tolerance)
        if i % 10 == 0:
            print(f"Processed {i}/{total_features} features")

    print(f"Writing to {output_path}...")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f)
    
    print("Done.")

if __name__ == "__main__":
    main()
