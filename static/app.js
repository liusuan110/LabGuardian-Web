const fileInput = document.querySelector("#fileInput");
const dropzone = document.querySelector("#dropzone");
const previewFrame = document.querySelector("#previewFrame");
const previewImage = document.querySelector("#previewImage");
const previewCaption = document.querySelector("#previewCaption");
const analyzeButton = document.querySelector("#analyzeButton");
const confInput = document.querySelector("#confInput");
const iouInput = document.querySelector("#iouInput");
const imgszInput = document.querySelector("#imgszInput");
const serverStatus = document.querySelector("#serverStatus");
const imageStage = document.querySelector("#imageStage");
const resultImage = document.querySelector("#resultImage");
const jsonOutput = document.querySelector("#jsonOutput");
const metrics = document.querySelector("#metrics");
const tabs = document.querySelector("#tabs");
const downloadLink = document.querySelector("#downloadLink");
const componentList = document.querySelector("#componentList");

let selectedFile = null;
let latestResult = null;
let activeKey = "components_and_pins";

function setStatus(text, tone = "ready") {
  serverStatus.textContent = text;
  serverStatus.dataset.tone = tone;
}

function setSelectedFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    setStatus("请选择图片文件", "warn");
    return;
  }

  selectedFile = file;
  analyzeButton.disabled = false;
  previewFrame.classList.add("has-image");
  previewCaption.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
  previewImage.src = URL.createObjectURL(file);
  setStatus("已选择图片");
}

function showResultImage(key) {
  if (!latestResult || !latestResult.images) return;
  const url = latestResult.images[key] || latestResult.images.components_and_pins;
  if (!url) return;

  activeKey = key;
  resultImage.src = `${url}?t=${Date.now()}`;
  imageStage.classList.add("has-result");
  downloadLink.href = url;
  downloadLink.style.display = "inline-flex";

  tabs.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.key === key);
  });
}

function updateMetrics(result) {
  const values = metrics.querySelectorAll("strong");
  values[0].textContent = result.component_count ?? "-";
  values[1].textContent = result.pin_count ?? "-";
  const size = result.image_size;
  values[2].textContent = size ? `${size.width} × ${size.height}` : "-";
}

function renderComponents(result) {
  const components = result.components || [];
  componentList.innerHTML = "";
  if (!components.length) {
    componentList.innerHTML = '<div class="component-empty">没有识别到元件，请尝试更清晰的俯视图或降低置信度。</div>';
    return;
  }

  components.forEach((component) => {
    const item = document.createElement("article");
    item.className = "component-item";
    const pins = (component.pins || [])
      .map((pin) => {
        const point = pin.top_keypoint ? pin.top_keypoint.map((value) => Math.round(value)).join(", ") : "未定位";
        return `<span>${pin.pin_name}: ${point}</span>`;
      })
      .join("");
    item.innerHTML = `
      <header>
        <strong>${component.component_id || ""} ${component.component_type || "UNKNOWN"}</strong>
        <span>${Number(component.confidence || 0).toFixed(2)}</span>
      </header>
      <div class="pin-list">${pins}</div>
    `;
    componentList.appendChild(item);
  });
}

async function analyze() {
  if (!selectedFile) return;

  const formData = new FormData();
  formData.append("image", selectedFile);
  formData.append("conf", confInput.value || "0.25");
  formData.append("iou", iouInput.value || "0.5");
  formData.append("imgsz", imgszInput.value || "960");

  analyzeButton.disabled = true;
  analyzeButton.textContent = "识别中...";
  setStatus("正在识别元件和引脚", "busy");

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.detail || "识别失败");
    }

    latestResult = payload;
    jsonOutput.textContent = JSON.stringify(payload, null, 2);
    updateMetrics(payload);
    renderComponents(payload);
    showResultImage(activeKey);
    setStatus("识别完成");
  } catch (error) {
    setStatus("识别失败", "warn");
    componentList.innerHTML = `<div class="component-empty">${error.message}</div>`;
    jsonOutput.textContent = JSON.stringify({ error: error.message }, null, 2);
  } finally {
    analyzeButton.disabled = false;
    analyzeButton.textContent = "开始识别元件和引脚";
  }
}

fileInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  setSelectedFile(file);
});

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.classList.add("dragging");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragging");
});

dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropzone.classList.remove("dragging");
  const [file] = event.dataTransfer.files;
  setSelectedFile(file);
});

tabs.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-key]");
  if (button) showResultImage(button.dataset.key);
});

analyzeButton.addEventListener("click", analyze);
