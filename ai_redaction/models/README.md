# ai_redaction/models/

Place OpenCV DNN model files here for the YuNet/SFace recognition path.
These files are **not committed** (gitignored). Download them once locally.

## Required files

| Filename | What it does | Source |
|----------|-------------|--------|
| `face_detection_yunet_2023mar.onnx` | YuNet face detector | [opencv_zoo](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet) |
| `face_recognition_sface_2021dec.onnx` | SFace 128-d embeddings | [opencv_zoo](https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface) |

## Quick download (curl)

```bash
# From repo root
curl -L -o ai_redaction/models/face_detection_yunet_2023mar.onnx \
  "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"

curl -L -o ai_redaction/models/face_recognition_sface_2021dec.onnx \
  "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx"
```

## Behaviour without model files

If either file is missing the pipeline degrades to the Haar-cascade path
(or returns `no_match` if Haar is also unavailable). No error is raised.

## Privacy

- Model files contain no user data — they are pre-trained weights only.
- No images, embeddings, or recognition results are stored in this directory.
- All recognition runs in-process on the local machine.
