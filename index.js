//== errands ==//
const mainUI = document.getElementById("main-ui");
const listItems = document.getElementById("item-list");
const rightSection = document.getElementById("right-section");
const searchBar = document.getElementById("search-bar");
const backgroundLayer = document.getElementById("background-layer");
let currentIndex = -1;
let currentFocus = "list";
let copyButton, blockButton, pageButton;

const body = document.getElementsByTagName("body")[0];
const bodyInfo = body.getBoundingClientRect();

// search bar
searchBar.addEventListener("keyup", delay(async function (e) {
    if (!(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key))) {
        const data = await getFullData(searchBar.value);
        currentIndex = -1;
        renderUI(data);
    }
}, 350));

function main() {
    logseq.Editor.registerSlashCommand(
        "Search Wikipedia",
        async () => {
            const { left, rect } = await logseq.Editor.getEditingCursorPosition();
            console.log("rect", rect)
            let adjustedLeft = 0, adjustedTop = 0;
            const padding = 10;

            logseq.showMainUI({ autoFocus: true });
            
            setTimeout(() => {
                if (rect.x + left + 500 + padding > window.innerWidth) {
                    adjustedLeft = rect.x + left - 500 - padding;
                } else {
                    adjustedLeft = rect.x + left;
                };
                
                if (rect.bottom + 400 + padding > window.innerHeight) {
                    adjustedTop = rect.y - 400 - padding;
                } else {
                    adjustedTop = rect.bottom;
                };
                
                Object.assign(backgroundLayer.style, {
                    top: adjustedTop + "px",
                    left: adjustedLeft + "px",
                });

                // console.log("window w h", window.innerWidth, window.innerHeight)
                // console.log("left, top", left, top)
                // console.log("adjusted", adjustedLeft, adjustedTop)

                body.style.visibility = "visible";
                
                searchBar.focus();
            }, 80);

        }
    )
}

document.addEventListener("keyup", e => {
    if (e.key === "f") {
        searchBar.focus();
    };
})

document.addEventListener("keyup", e => {
    if (e.key === "Escape") {
        closeModal();
    };
    e.stopPropagation()
})

//== main activity ==//

// utils
function closeModal() {
    clearCurrentContext();
    searchBar.value = "";
    body.style.visibility = "hidden";
    logseq.hideMainUI({ restoreEditingcurrentIndex: true })
}

function delay(func, time) {
    let timer = 0;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(func.bind(this, ...args), time || 0)
    }
}

function clearCurrentContext() {
    while (listItems.firstChild) {
        listItems.removeChild(listItems.lastChild)
    };

    while (rightSection.firstChild) {
        rightSection.removeChild(rightSection.lastChild)
    };

    currentIndex = -1;
}

window.addEventListener("click", e => {
    if (e.target.closest("#main-ui") === null) {
        closeModal();
    }
})

// -- 

// insert
async function insertBlockCustomized(title, content) {
    const currentBlock = await logseq.Editor.getCurrentBlock();
    const insertContent = `${title}: ${content}`
    if (currentBlock.content != "") {
        await logseq.Editor.insertBlock(currentBlock.uuid, insertContent, { sibling: true });
    } else {
        await logseq.Editor.updateBlock(currentBlock.uuid, insertContent);
    }
}

async function insertPage(pageName, content) {
    await logseq.Editor.insertAtEditingCursor(`[[${pageName}]]`)

    await createPageCustomized(pageName, content);
}

async function createPageCustomized(pageName, content) {
    let page = await logseq.Editor.getPage(pageName);

    if (!page) {
        await logseq.Editor.createPage(
            pageName,
            {},
            {
                createFirstBlock: true,
                redirect: false,
            }
        );

        const targetBlock = await getLastBlock(pageName);
        if (targetBlock) {
            await logseq.Editor.updateBlock(targetBlock.uuid, content);
        }
    } else {
        console.log("bruh");
        const lastBlock = await getLastBlock(pageName);
        if (lastBlock === null) {
            await logseq.Editor.deletePage(pageName);
            await logseq.Editor.createPage(
                pageName,
                {},
                {
                    createFirstBlock: true,
                    redirect: false,
                }
            );

            const targetBlock = await getLastBlock(pageName);
            if (targetBlock) {
                await logseq.Editor.updateBlock(targetBlock.uuid, content);
            }
        }
    }
}

async function getLastBlock(pageName) {
    const blocks = await logseq.Editor.getPageBlocksTree(pageName);
    if (blocks.length === 0) {
        return null
    }
    return blocks[blocks.length - 1];
}

// -- 

// get search results

async function getSummary(key) {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${key}`
    return fetch(url)
        .then(res => res.json())
        .then(data => data.extract)
}

async function getContext(url) {
    return fetch(url)
        .then(res => res.json())
        .then(data => data)
}

async function getFullData(keyword) {
    const url = `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${keyword}&limit=8`;
    const rawData = await getContext(url);

    for (const page of rawData.pages) {
        page.summary = await getSummary(page.key)
    }

    return rawData.pages
}

// -- 


// render UI
function renderUI(data) {
    clearCurrentContext();
    let listIndex = 0;
    for (const page of data) {
        listItems.insertAdjacentHTML("beforeend",
            `<li data-page-id="${page.id}" tabindex="-1" data-index="${listIndex}">${page.title}</li>`);
        listIndex += 1;

        rightSection.insertAdjacentHTML("beforeend",
            `<div class="hide page-content-container" data-page-id="${page.id}" data-page-title="${page.title}">
                <div class="right-footer">
                    <div class="button-container">
                        <button tabindex="0" data-index="0" class="copy footer-button">Copy <i class="bi bi-stickies"></i></button>
                        <button tabindex="0" data-index="1" class="insert-block footer-button">+ Block <i class="bi bi-box"></i></button>
                        <button tabindex="0" data-index="2" class="insert-page footer-button">+ Page <i class="bi bi-file-earmark-plus"></i></button>
                    </div>
                </div>
                <p class="content">${page.summary}</p>
            </div>`);
    }

    // listItems event
    for (const item of listItems.querySelectorAll("li")) {
        item.addEventListener("mouseover", () => item.focus());

        item.addEventListener("focus", () => {
            currentIndex = Number(item.dataset.index);

            for (const elem of rightSection.querySelectorAll("div.page-content-container")) {
                if (elem.dataset.pageId !== item.dataset.pageId) {
                    elem.classList.add("hide")
                    elem.classList.remove("show");
                } else {
                    elem.classList.add("show");
                    elem.classList.remove("hide");
                }
            }
        });
    }

    // button events
    for (const elem of rightSection.querySelectorAll("div.page-content-container")) {
        const title = elem.dataset.pageTitle;
        const content = elem.querySelector("p").textContent;

        // insert block
        elem.querySelector("button.insert-block").addEventListener("click", async (e) => {
            e.stopPropagation();
            await insertBlockCustomized(title, content);
            closeModal();
        }, { once: true })

        // insert page
        elem.querySelector("button.insert-page").addEventListener("click", async (e) => {
            e.stopPropagation();
            await insertPage(title, content);
            closeModal();
        }, { once: true })

        // copy
        elem.querySelector("button.copy").addEventListener("click", async (e) => {
            e.stopPropagation();
            await navigator.clipboard.writeText(`${title}: ${content}`);
            closeModal();
        }, { once: true })

        for (const button of elem.querySelectorAll("button")) {
            button.addEventListener("mouseover", () => button.focus());
        }
    }
}

// arrow navigation and keyboard events

function getCurrentButtons() {
    const currentButtonContainer = document.querySelector("div.page-content-container.show").querySelector(".button-container");

    const copyButton = currentButtonContainer.querySelector(".copy");
    const blockButton = currentButtonContainer.querySelector(".insert-block");
    const pageButton = currentButtonContainer.querySelector(".insert-page");

    return [copyButton, blockButton, pageButton]
}

document.addEventListener("keyup", e => {
    if (["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        const allItems = listItems.querySelectorAll("li");

        switch (e.key) {
            case "ArrowDown":
                if (currentIndex === allItems.length - 1) {
                    currentIndex = 0;
                } else {
                    currentIndex += 1;
                };
                for (const item of allItems) {
                    if (Number(item.dataset.index) === currentIndex) {
                        item.focus();
                        break;
                    }
                };
                break;
            case "ArrowUp":
                if (currentIndex === 0) {
                    currentIndex = allItems.length - 1;
                } else {
                    currentIndex -= 1;
                };
                for (const item of allItems) {
                    if (Number(item.dataset.index) === currentIndex) {
                        item.focus();
                        break;
                    }
                };
                break;
            case "ArrowRight":
                [copyButton, blockButton, pageButton] = getCurrentButtons();

                for (const button of [copyButton, blockButton, pageButton]) {
                    if (copyButton === document.activeElement) {
                        blockButton.focus();
                        break;
                    } else if (blockButton === document.activeElement) {
                        pageButton.focus();
                        break;
                    } else if (pageButton === document.activeElement) {
                        break;
                    } else {
                        copyButton.focus();
                        break;
                    }
                };

                break;
            case "ArrowLeft":
                [copyButton, blockButton, pageButton] = getCurrentButtons();

                for (const button of [copyButton, blockButton, pageButton]) {
                    if (pageButton === document.activeElement) {
                        blockButton.focus();
                        break;
                    } else if (blockButton === document.activeElement) {
                        copyButton.focus();
                        break;
                    } else {
                        break;
                    }
                }
        }
    }
});

document.addEventListener("keyup", e => {
    if (e.key === "Enter") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if ([copyButton, blockButton, pageButton].includes(document.activeElement)) {
            document.activeElement.click();
        }
    }
});

window.addEventListener("keydown", e => {
    if (["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
    }
})

// --

//== init ==//
logseq.ready(main).catch(console.error)
