import { RESULT_IMAGE_KEYS } from "./config.js";

export function createAppState() {
  return {
    selectedFile: null,
    previewObjectUrl: null,
    latestResult: null,
    activeImageKey: RESULT_IMAGE_KEYS.annotated,
    isAnalyzing: false,
  };
}
