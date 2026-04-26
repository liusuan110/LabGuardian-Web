import { analyzeImage } from "./api.js";
import { DEFAULT_ANALYZE_OPTIONS } from "./config.js";
import { getElements } from "./dom.js";
import {
  renderError,
  renderResult,
  renderSelectedFile,
  setAnalyzing,
  setStatus,
  showResultImage,
} from "./render.js";
import { createAppState } from "./state.js";

const elements = getElements();
const state = createAppState();

function getAnalyzeOptions() {
  return {
    conf: elements.confInput.value || DEFAULT_ANALYZE_OPTIONS.conf,
    iou: elements.iouInput.value || DEFAULT_ANALYZE_OPTIONS.iou,
    imgsz: elements.imgszInput.value || DEFAULT_ANALYZE_OPTIONS.imgsz,
  };
}

function selectFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    setStatus(elements, "请选择图片文件", "warn");
    return;
  }

  renderSelectedFile(elements, state, file);
  setStatus(elements, "已选择图片");
}

async function analyzeSelectedFile() {
  if (!state.selectedFile || state.isAnalyzing) return;

  state.isAnalyzing = true;
  setAnalyzing(elements, true);
  setStatus(elements, "正在识别元件和引脚", "busy");

  try {
    const result = await analyzeImage(state.selectedFile, getAnalyzeOptions());
    renderResult(elements, state, result);
    setStatus(elements, "识别完成");
  } catch (error) {
    setStatus(elements, "识别失败", "warn");
    renderError(elements, error.message);
  } finally {
    state.isAnalyzing = false;
    setAnalyzing(elements, false);
  }
}

elements.fileInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  selectFile(file);
});

elements.dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  elements.dropzone.classList.add("dragging");
});

elements.dropzone.addEventListener("dragleave", () => {
  elements.dropzone.classList.remove("dragging");
});

elements.dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  elements.dropzone.classList.remove("dragging");
  const [file] = event.dataTransfer.files;
  selectFile(file);
});

elements.tabs.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-key]");
  if (button) showResultImage(elements, state, button.dataset.key);
});

elements.analyzeButton.addEventListener("click", analyzeSelectedFile);
