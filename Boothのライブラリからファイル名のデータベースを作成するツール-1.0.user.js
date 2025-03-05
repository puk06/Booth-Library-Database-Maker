// ==UserScript==
// @name         Boothのライブラリからファイル名のデータベースを作成するツール
// @namespace    https://x.com/pukorufu
// @version      1.0
// @description  Boothのライブラリからファイル名のデータベースを作成します。データベースはjson形式で出力されます。AE-Toolsで使用可能です。
// @author       pukorufu
// @match        https://accounts.booth.pm/library
// @match        https://accounts.booth.pm/library/gifts
// @match        https://accounts.booth.pm/library/gifts?*
// @match        https://accounts.booth.pm/library?*
// @grant        GM_getValue
// @grant        GM_setValue
// @license      MIT
// ==/UserScript==

const LocalStorageKey = "aetools-asset-database";
const STYLES = {
	FIXED_BUTTON: {
		color: "#ffffff",
		borderRadius: "20px",
		padding: "10px 15px",
		border: "none",
		boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
		cursor: "pointer",
		position: "fixed",
		zIndex: "1000",
	},
	COLORS: {
		PRIMARY: "#fc4d50",
		PRIMARY_HOVER: "#ff6669",
		AUTO: "#1b7f8c",
		AUTO_HOVER: "#22a1b2",
		AUTO_STOP: "#f30f4c",
		AUTO_STOP_HOVER: "#c00b3c",
	},
};

(function () {
	// URL Parameter Management
	class URLManager {
		constructor() {
			this.url = new URL(window.location.href);
			this.initializeParams();
		}

		initializeParams() {
			const params = [
				["auto", this.url.searchParams.get("auto") === "1" ? "1" : "0"],
				["gift", this.url.searchParams.get("gift") || "0"],
				["page", this.url.searchParams.get("page") || "1"]
			];

			let changed = false;
			params.forEach(([key, defaultValue]) => {
				if (this.url.searchParams.get(key) === null) {
					this.url.searchParams.set(key, defaultValue);
					changed = true;
				}
			});

			if (changed) {
				window.location.href = this.url.href;
			}
		}

		static processNextPage(url) {
			const parsedURL = new URL(url);
			const currentPage = parseInt(parsedURL.searchParams.get("page"), 10);
			parsedURL.searchParams.set("page", (currentPage + 1).toString());
			window.location.href = parsedURL.href;
		}

		static resetToFirstPage() {
			const parsedURL = new URL(window.location.href);
			parsedURL.searchParams.set("page", "1");
			parsedURL.searchParams.set("gift", "0");
			parsedURL.searchParams.set("auto", "0");
			parsedURL.pathname = "/library";
			window.location.href = parsedURL.href;
		}
	}

	// Item Management
	class ItemManager {
		static collectItemInfo(itemElement) {
			if (!itemElement.firstChild) {
				return null;
			}

			const url = itemElement.getElementsByClassName("pb-16")[0]?.getElementsByTagName("a")[0].href;
			if (!url) {
				return null;
			}

			const title = itemElement.getElementsByClassName("mb-8")[0]?.innerText || "No Title";

			let files = [];
			const fileNodes = itemElement.getElementsByClassName("mt-16");
			for (const element of fileNodes) {
				const file = element.innerText.split("\n")[0];
				files.push(file);
			}

			return {
				title: title,
				id: parseInt(url.split("/")[url.split("/").length - 1]),
				files: files
			};
		}
	}

	// UI Components
	class UIComponents {
		static createButton(text, options) {
			const button = document.createElement("button");
			button.innerText = text;
			Object.assign(button.style, STYLES.FIXED_BUTTON, options.style);
			button.addEventListener(
				"mouseover",
				() => (button.style.background = options.hoverColor)
			);
			button.addEventListener(
				"mouseout",
				() => (button.style.background = options.baseColor)
			);
			button.onclick = options.onClick;
			document.body.appendChild(button);
			return button;
		}

		static addAutoButton(autoMode) {
			return this.createButton(
				autoMode ? "データベース作成を停止" : "データベース作成開始！",
				{
					style: {
						background: autoMode
							? STYLES.COLORS.AUTO_STOP
							: STYLES.COLORS.AUTO,
						bottom: "10px",
						left: "10px",
					},
					baseColor: autoMode
						? STYLES.COLORS.AUTO_STOP
						: STYLES.COLORS.AUTO,
					hoverColor: autoMode
						? STYLES.COLORS.AUTO_STOP_HOVER
						: STYLES.COLORS.AUTO_HOVER,
					onClick: autoMode ? this.stopAuto : this.startAuto,
				}
			);
		}

		static startAuto() {
			localStorage.setItem(LocalStorageKey, JSON.stringify([]));
			const url = new URL(window.location.href);
			url.pathname = "/library";
			url.searchParams.set("auto", "1");
			url.searchParams.set("page", "1");
			url.searchParams.set("gift", "0");
			window.location.href = url.href;
		}

		static stopAuto() {
			const url = new URL(window.location.href);
			url.searchParams.set("auto", "0");
			url.searchParams.set("page", "1");
			url.searchParams.set("gift", "0");
			url.pathname = "/library";
			window.location.href = url.href;
		}
	}

	async function main() {
		const url = new URL(window.location.href);
		const itemListTag = url.searchParams.get("gift")  === "1" ? "mb-40" : "mb-24";

		const itemListElements = Array.from(document.getElementsByClassName(itemListTag)[0].children);
		itemListElements.pop();

		let itemList = itemListElements.map(ItemManager.collectItemInfo);
		itemList = itemList.filter((item) => item !== null);

		if (itemList.length === 0) {
			if (url.searchParams.get("gift") == "0") {
				url.pathname = "/library/gifts";
				url.searchParams.set("gift", "1");
				url.searchParams.set("page", "1");
				window.location.href = url.href;
				return;
			}

			alert("アセットのデータベースの作成が終わりました。エクスポートします。");
			const database = JSON.parse(localStorage.getItem(LocalStorageKey) || "[]");

			const a = document.createElement("a");
			const blob = new Blob([JSON.stringify(database, null, 4)], { type: "text/json" });
			a.href = URL.createObjectURL(blob);
			a.download = "booth-asset-database.json";

			document.body.appendChild(a);
			a.click();

			URLManager.resetToFirstPage();
			return;
		}

		//データベースを取得
		const database = JSON.parse(localStorage.getItem(LocalStorageKey) || "[]");

		for (const item of itemList) {
			database.push({
				title: item.title,
				id: item.id,
				files: item.files
			});
		}

		//データベースを保存
		localStorage.setItem(LocalStorageKey, JSON.stringify(database));

		//3秒待つ (サーバーへの負荷軽減)
		await new Promise((resolve) => setTimeout(resolve, 3000));

		URLManager.processNextPage(url);
	}

	// Initialize
	const urlManager = new URLManager();
	const autoMode = urlManager.url.searchParams.get('auto') === '1';

	UIComponents.addAutoButton(autoMode);

	if (autoMode) {
		main();
	}
})();
