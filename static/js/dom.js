export function getElements() {
  return {
    fileInput: document.querySelector("#fileInput"),
    dropzone: document.querySelector("#dropzone"),
    previewFrame: document.querySelector("#previewFrame"),
    previewImage: document.querySelector("#previewImage"),
    previewCaption: document.querySelector("#previewCaption"),
    analyzeButton: document.querySelector("#analyzeButton"),
    confInput: document.querySelector("#confInput"),
    iouInput: document.querySelector("#iouInput"),
    imgszInput: document.querySelector("#imgszInput"),
    serverStatus: document.querySelector("#serverStatus"),
    imageStage: document.querySelector("#imageStage"),
    resultImage: document.querySelector("#resultImage"),
    jsonOutput: document.querySelector("#jsonOutput"),
    metrics: document.querySelector("#metrics"),
    tabs: document.querySelector("#tabs"),
    downloadLink: document.querySelector("#downloadLink"),
    componentList: document.querySelector("#componentList"),
  };
}
