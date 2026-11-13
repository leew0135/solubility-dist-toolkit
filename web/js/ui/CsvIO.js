/*
 * CsvIO.js — reading an uploaded file and saving a result file, entirely in the browser.
 *
 * WHAT IT DOES
 *   readTextFile(file)            text of a file the user picked or dropped (never sent anywhere)
 *   downloadText(name, text)      save text (CSV) to the user's Downloads folder
 *   bindUpload(box, onText)       makes an upload box work for both click-to-pick and drag-and-drop
 *
 *   Parsing of the CSV columns is done in Python (solubility_toolkit/io.py via web_api),
 *   so the website and the package accept exactly the same files.
 *
 * HOW TO CHANGE
 *   Accepted columns -> solubility_toolkit/io.py.   Look of the upload box -> styles/site.css (.upload).
 */
export async function readTextFile(file) {
  const text = await file.text();
  return text.replace(/^﻿/, "");            // Excel adds an invisible mark at the start
}

export function downloadText(filename, text, mime = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** box: a <label class="upload"> that contains an <input type="file">. onText(text, fileName). */
export function bindUpload(box, onText) {
  const input = box.querySelector('input[type="file"]');
  const take = async (file) => { if (file) onText(await readTextFile(file), file.name); };
  input.addEventListener("change", () => { take(input.files[0]); input.value = ""; });
  box.addEventListener("dragover", (e) => { e.preventDefault(); box.classList.add("dragging"); });
  box.addEventListener("dragleave", () => box.classList.remove("dragging"));
  box.addEventListener("drop", (e) => { e.preventDefault(); box.classList.remove("dragging"); take(e.dataTransfer.files[0]); });
}
