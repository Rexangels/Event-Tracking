from PIL import Image, ExifTags
from typing import Dict, Any

class MetadataExtractor:
    @staticmethod
    def extract_from_file(file_obj) -> Dict[str, Any]:
        """
        Extracts metadata from a file object.
        Currently supports Image EXIF data.
        """
        metadata = {}
        
        # Reset file pointer to beginning
        pos = file_obj.tell()
        file_obj.seek(0)
        
        try:
            # Check if it's an image
            if 'image' in file_obj.content_type:
                try:
                    img = Image.open(file_obj)
                    if hasattr(img, '_getexif') and img._getexif():
                        exif = {
                            ExifTags.TAGS[k]: v
                            for k, v in img._getexif().items()
                            if k in ExifTags.TAGS
                        }
                        # Filter for interesting tags to avoid huge JSON blobs
                        interesting_tags = ['Make', 'Model', 'DateTimeOriginal', 'GPSInfo']
                        for tag in interesting_tags:
                            if tag in exif:
                                # GPSInfo needs careful serializing, skipping for MVP simplicity or keeping raw
                                if tag == 'GPSInfo':
                                     metadata['GPS'] = str(exif[tag]) 
                                else:
                                    metadata[tag] = str(exif[tag])
                except Exception as e:
                    metadata['error'] = f"Image processing failed: {str(e)}"
        
        except Exception as e:
            metadata['error'] = str(e)
            
        finally:
            # Reset file pointer for subsequent saving
            file_obj.seek(pos)
            
        return metadata
