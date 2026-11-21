const OWNER = "strawberrislushi0-cpu";
const REPO = "goofinitup";
const BRANCH = "main"; // Only needed for the fallback link, not the API listing.
const FOLDER = "Files";

const display = document.querySelector("#display");
const filename = document.querySelector("#filename");
const counter = document.querySelector("#counter");
const status = document.querySelector("#status");
const original = document.querySelector("#open");
const previous = document.querySelector("#previous");
const next = document.querySelector("#next");
let files = [];
let index = 0;
let renderToken = 0;

const extension = (name) => name.split(".").pop().toLowerCase();
const makeElement = (tag, attributes = {}) => {
	const node = document.createElement(tag);
	for (const [key, value] of Object.entries(attributes)) node[key] = value;
	return node;
};

function showMessage(message) {
	display.replaceChildren(makeElement("p", { className: "hint", textContent: message }));
}

async function showFile() {
	const token = ++renderToken;
	const item = files[index];
	previous.disabled = files.length < 2;
	next.disabled = files.length < 2;
	counter.textContent = `${files.length ? index + 1 : 0} / ${files.length}`;
	filename.textContent = item?.name ?? "—";
	original.hidden = !item;
	if (!item) { showMessage("No files found in Files/. Add a file to your repository!"); return; }

	const url = item.download_url || `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${FOLDER}/${encodeURIComponent(item.name)}`;
	original.href = url;
	const ext = extension(item.name);
	let node;
	if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"].includes(ext)) {
		node = makeElement("img", { src: url, alt: item.name });
	} else if (["mp4", "webm", "ogv", "mov"].includes(ext)) {
		node = makeElement("video", { src: url, controls: true, playsInline: true });
	} else if (["mp3", "wav", "ogg", "m4a", "flac"].includes(ext)) {
		node = makeElement("audio", { src: url, controls: true });
	} else if (ext === "pdf") {
		node = makeElement("iframe", { src: url, title: item.name });
	} else if (["txt", "md", "json", "csv", "html", "css", "js", "xml", "py", "gd"].includes(ext)) {
		showMessage("Loading text…");
		try {
			const response = await fetch(url);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const text = await response.text();
			if (token !== renderToken) return;
			node = makeElement("pre", { textContent: text });
		} catch {
			if (token !== renderToken) return;
			showMessage("Could not preview this text file. Use Open original.");
			return;
		}
	} else {
		node = makeElement("p", { className: "hint", textContent: "Preview unavailable for this file type. Select Open original." });
	}
	if (token === renderToken) display.replaceChildren(node);
}

function changeFile(amount) {
	if (files.length < 2) return;
	index = (index + amount + files.length) % files.length;
	showFile();
}

async function loadFiles() {
	status.textContent = "Checking GitHub…";
	try {
		const path = FOLDER.split("/").map(encodeURIComponent).join("/");
		const endpoint = `https://api.github.com/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(REPO)}/contents/${path}`;
		const response = await fetch(endpoint, { cache: "no-store", headers: { Accept: "application/vnd.github+json" } });
		if (!response.ok) throw new Error(`GitHub API returned ${response.status}. Check the username, repository, folder, and public visibility.`);
		const entries = await response.json();
		if (!Array.isArray(entries)) throw new Error("Files must be a folder, not a file.");
		const selected = files[index]?.name;
		files = entries.filter((entry) => entry.type === "file" && entry.name !== ".gitkeep")
			.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
		index = Math.max(0, files.findIndex((file) => file.name === selected));
		status.textContent = `${files.length} file${files.length === 1 ? "" : "s"} found · ${FOLDER}/`;
		showFile();
	} catch (error) {
		status.textContent = "Could not load files";
		showMessage(error.message);
		filename.textContent = "—";
		counter.textContent = "0 / 0";
		original.hidden = true;
		previous.disabled = true;
		next.disabled = true;
	}
}

previous.addEventListener("click", () => changeFile(-1));
next.addEventListener("click", () => changeFile(1));
document.querySelector("#refresh").addEventListener("click", loadFiles);
window.addEventListener("keydown", (event) => {
	if (["ArrowLeft", "ArrowRight"].includes(event.key) && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
		event.preventDefault();
		changeFile(event.key === "ArrowRight" ? 1 : -1);
	}
});

// One scroll gesture changes one file; scrolling inside text/PDF stays usable.
let lastWheel = 0;
window.addEventListener("wheel", (event) => {
	if (event.target.closest("pre, iframe") || !files.length) return;
	if (Math.abs(event.deltaY) < 12 && Math.abs(event.deltaX) < 12) return;
	const now = Date.now();
	if (now - lastWheel < 500) return;
	lastWheel = now;
	changeFile((Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) > 0 ? 1 : -1);
}, { passive: true });

let startX = null;
display.addEventListener("touchstart", (event) => { startX = event.changedTouches[0].screenX; }, { passive: true });
display.addEventListener("touchend", (event) => {
	if (startX === null) return;
	const moved = event.changedTouches[0].screenX - startX;
	if (Math.abs(moved) > 60) changeFile(moved < 0 ? 1 : -1);
	startX = null;
}, { passive: true });

loadFiles();
