import { RESULT_IMAGE_KEYS } from "./config.js";

export function setStatus(elements, text, tone = "ready") {
  elements.serverStatus.textContent = text;
  elements.serverStatus.dataset.tone = tone;
}

export function setAnalyzing(elements, isAnalyzing) {
  elements.analyzeButton.disabled = isAnalyzing;
  elements.analyzeButton.textContent = isAnalyzing ? "识别中..." : "开始识别元件和引脚";
  elements.analyzeButton.classList.toggle("is-loading", isAnalyzing);
}

export function renderSelectedFile(elements, state, file) {
  state.selectedFile = file;
  elements.analyzeButton.disabled = false;
  elements.previewFrame.classList.add("has-image");
  elements.previewCaption.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;

  if (state.previewObjectUrl) {
    URL.revokeObjectURL(state.previewObjectUrl);
  }
  state.previewObjectUrl = URL.createObjectURL(file);
  elements.previewImage.src = state.previewObjectUrl;
}

export function showResultImage(elements, state, key) {
  if (!state.latestResult?.images) return;
  const fallback = state.latestResult.images[RESULT_IMAGE_KEYS.annotated];
  const url = state.latestResult.images[key] || fallback;
  if (!url) return;

  state.activeImageKey = key;
  elements.resultImage.src = `${url}?t=${Date.now()}`;
  elements.imageStage.classList.add("has-result");
  elements.downloadLink.href = url;
  elements.downloadLink.style.display = "inline-flex";

  elements.tabs.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.key === key);
  });
}

export function renderMetrics(elements, result) {
  const values = elements.metrics.querySelectorAll("strong");
  values[0].textContent = result.component_count ?? "-";
  values[1].textContent = result.pin_count ?? "-";
  const size = result.image_size;
  values[2].textContent = size ? `${size.width} × ${size.height}` : "-";
}

function createEmptyMessage(message) {
  const empty = document.createElement("div");
  empty.className = "component-empty";
  empty.textContent = message;
  return empty;
}

export function renderComponents(elements, result) {
  const components = result.components || [];
  elements.componentList.innerHTML = "";
  if (!components.length) {
    elements.componentList.appendChild(
      createEmptyMessage("没有识别到元件，请尝试更清晰的俯视图或降低置信度。"),
    );
    return;
  }

  components.forEach((component) => {
    const item = document.createElement("article");
    item.className = "component-item";

    const header = document.createElement("header");
    const title = document.createElement("strong");
    title.textContent = `${component.component_id || ""} ${component.component_type || "UNKNOWN"}`.trim();
    const confidence = document.createElement("span");
    confidence.textContent = Number(component.confidence || 0).toFixed(2);
    header.append(title, confidence);

    const pinList = document.createElement("div");
    pinList.className = "pin-list";
    (component.pins || []).forEach((pin) => {
      const point = pin.top_keypoint
        ? pin.top_keypoint.map((value) => Math.round(value)).join(", ")
        : "未定位";
      const pinItem = document.createElement("span");
      pinItem.textContent = `${pin.pin_name}: ${point}`;
      pinList.appendChild(pinItem);
    });

    item.append(header, pinList);
    elements.componentList.appendChild(item);
  });
}

export function renderResult(elements, state, result) {
  state.latestResult = result;
  elements.jsonOutput.textContent = JSON.stringify(result, null, 2);
  renderMetrics(elements, result);
  renderComponents(elements, result);
  showResultImage(elements, state, state.activeImageKey);
}

export function renderError(elements, message) {
  elements.componentList.innerHTML = "";
  elements.componentList.appendChild(createEmptyMessage(message));
  elements.jsonOutput.textContent = JSON.stringify({ error: message }, null, 2);
}
