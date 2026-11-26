
const OWNER = "strawberrislushi0-cpu";
const REPO = "goofinitup";
const BRANCH = "main";
const FOLDER = "Files";

const display = document.querySelector("#display");
const filename = document.querySelector("#filename");
const counter = document.querySelector("#counter");
const status = document.querySelector("#status");
const original = document.querySelector("#open");
const filenameHeader = document.querySelector("#filename-header");
const sidebarFilename = document.querySelector("#sidebar-filename");
const previous = document.querySelector("#previous");
const next = document.querySelector("#next");

let files = [];
let index = 0;
let renderToken = 0;

const extension = (name) => name.split(".").pop().toLowerCase();

function makeElement(tag, attributes = {}) {
	const node = document.createElement(tag);

	for (const [key, value] of Object.entries(attributes)) {
		node[key] = value;
	}

	return node;
}

// Stop currently playing media
function stopMedia() {
	display.querySelectorAll("video, audio").forEach(media => {
		media.pause();
		media.removeAttribute("src");
		media.load();
	});
}

// Automatically play media
async function playMedia(node, token) {
	if (!(node instanceof HTMLMediaElement)) return;
	if (token !== renderToken) return;

	try {
		await node.play();
	} catch (error) {
		if (token !== renderToken) return;

		// Fall back to muted autoplay if sound is blocked
		if (
			node instanceof HTMLVideoElement &&
			error.name === "NotAllowedError"
		) {
			node.muted = true;

			try {
				await node.play();
			} catch {
				// Native playback controls remain available
			}
		}
	}
}

// Retry blocked playback after user interaction
function unlockPlayback() {
	const media = display.querySelector("video, audio");

	if (!media) return;

	if (media.muted) {
		media.muted = false;
	}

	if (media.paused) {
		playMedia(media, renderToken);
	}
}

window.addEventListener("pointerdown", event => {
	if (!event.target.closest("video, audio")) {
		unlockPlayback();
	}
}, { once: true });

function showMessage(message) {
	stopMedia();

	display.replaceChildren(
		makeElement("p", {
			className: "hint",
			textContent: message
		})
	);
}

async function showFile() {
	const token = ++renderToken;
	const item = files[index];

	// Stop previous media immediately
	stopMedia();

	previous.disabled = files.length < 2;
	next.disabled = files.length < 2;

	counter.textContent =
		`${files.length ? index + 1 : 0} / ${files.length}`;

	filename.textContent = item?.name ?? "—";
	filenameHeader.textContent = item?.name ?? "—";
	sidebarFilename.textContent = item?.name ?? "My Files";

	original.hidden = !item;

	if (!item) {
		showMessage("No files found in Files/. Add a file!");
		return;
	}

	const fallback =
		`https://raw.githubusercontent.com/` +
		`${OWNER}/${REPO}/${BRANCH}/${FOLDER}/` +
		encodeURIComponent(item.name);

	const url = item.download_url || fallback;

	original.href = url;

	const ext = extension(item.name);
	let node;

	// Images
	if ([
		"png", "jpg", "jpeg", "gif",
		"webp", "svg", "bmp", "avif"
	].includes(ext)) {
		node = makeElement("img", {
			src: url,
			alt: item.name
		});
	}

	// Videos with autoplay
	else if ([
		"mp4", "webm", "ogv", "mov"
	].includes(ext)) {
		node = makeElement("video", {
			src: url,
			controls: true,
			playsInline: true,
			autoplay: true,
			preload: "auto"
		});
	}

	// Audio with autoplay
	else if ([
		"mp3", "wav", "ogg", "m4a", "flac"
	].includes(ext)) {
		node = makeElement("audio", {
			src: url,
			controls: true,
			autoplay: true,
			preload: "auto"
		});
	}

	// PDFs
	else if (ext === "pdf") {
		node = makeElement("iframe", {
			src: url,
			title: item.name
		});
	}

	// Text and code
	else if ([
		"txt", "md", "json", "csv",
		"html", "css", "js", "xml",
		"py", "gd"
	].includes(ext)) {
		showMessage("Loading text…");

		try {
			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			const text = await response.text();

			if (token !== renderToken) return;

			node = makeElement("pre", {
				textContent: text
			});
		} catch {
			if (token !== renderToken) return;

			showMessage(
				"Could not preview this file. Use Open original."
			);

			return;
		}
	}

	else {
		node = makeElement("p", {
			className: "hint",
			textContent:
				"Preview unavailable. Select Open original."
		});
	}

	if (token === renderToken) {
		display.replaceChildren(node);

		// Autoplay newly displayed media
		playMedia(node, token);
	}
}

// Go backward or forward and loop around
function changeFile(amount) {
	if (files.length < 2) return;

	index = (index + amount + files.length) % files.length;

	showFile();
}

// Get the latest files from GitHub
async function loadFiles() {
	status.textContent = "Checking GitHub…";

	try {
		const path = FOLDER.split("/")
			.map(encodeURIComponent)
			.join("/");

		const endpoint =
			`https://api.github.com/repos/` +
			`${encodeURIComponent(OWNER)}/` +
			`${encodeURIComponent(REPO)}/contents/${path}` +
			`?ref=${encodeURIComponent(BRANCH)}`;

		const response = await fetch(endpoint, {
			cache: "no-store",
			headers: {
				Accept: "application/vnd.github+json"
			}
		});

		if (!response.ok) {
			throw new Error(
				`GitHub API error: ${response.status}. ` +
				"Check your repository settings."
			);
		}

		const entries = await response.json();

		if (!Array.isArray(entries)) {
			throw new Error("Files must be a folder.");
		}

		const selected = files[index]?.name;

		files = entries
			.filter(entry =>
				entry.type === "file" &&
				entry.name !== ".gitkeep"
			)
			.sort((a, b) =>
				a.name.localeCompare(
					b.name,
					undefined,
					{
						numeric: true,
						sensitivity: "base"
					}
				)
			);

		index = Math.max(
			0,
			files.findIndex(file => file.name === selected)
		);

		status.textContent =
			`${files.length} file(s) found in ${FOLDER}/`;

		showFile();

	} catch (error) {
		++renderToken;

		status.textContent = "Could not load files";
		showMessage(error.message);

		filename.textContent = "—";
		filenameHeader.textContent = "—";
		sidebarFilename.textContent = "My Files";
		counter.textContent = "0 / 0";

		original.hidden = true;
		previous.disabled = true;
		next.disabled = true;
	}
}

// Buttons
previous.addEventListener("click", () => changeFile(-1));
next.addEventListener("click", () => changeFile(1));

document.querySelector("#refresh")
	.addEventListener("click", loadFiles);

// Keyboard navigation
window.addEventListener("keydown", event => {
	if (
		["ArrowLeft", "ArrowRight"].includes(event.key) &&
		!["INPUT", "TEXTAREA"].includes(
			document.activeElement.tagName
		)
	) {
		event.preventDefault();

		changeFile(event.key === "ArrowRight" ? 1 : -1);
	}
});

// Mouse wheel navigation
let lastWheel = 0;

window.addEventListener("wheel", event => {
	if (event.target.closest("pre, iframe") || !files.length) {
		return;
	}

	if (
		Math.abs(event.deltaY) < 12 &&
		Math.abs(event.deltaX) < 12
	) {
		return;
	}

	const now = Date.now();

	if (now - lastWheel < 500) return;

	lastWheel = now;

	const delta =
		Math.abs(event.deltaX) > Math.abs(event.deltaY)
			? event.deltaX
			: event.deltaY;

	changeFile(delta > 0 ? 1 : -1);

}, { passive: true });

// Touchscreen navigation
let startX = null;

display.addEventListener("touchstart", event => {
	startX = event.changedTouches[0].screenX;
}, { passive: true });

display.addEventListener("touchend", event => {
	if (startX === null) return;

	const moved =
		event.changedTouches[0].screenX - startX;

	if (Math.abs(moved) > 60) {
		changeFile(moved < 0 ? 1 : -1);
	}

	startX = null;
}, { passive: true });

// Windows XP taskbar clock
function updateClock() {
	const clock = document.querySelector("#clock");

	clock.textContent = new Date().toLocaleTimeString([], {
		hour: "numeric",
		minute: "2-digit"
	});
}

updateClock();
setInterval(updateClock, 30000);

// Initial loading with autoplay
loadFiles();
