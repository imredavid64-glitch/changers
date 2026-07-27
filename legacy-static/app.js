const strandFilters = document.getElementById("strand-filters");
const posts = Array.from(document.querySelectorAll(".post"));

function applyFilter(strand) {
  posts.forEach((post) => {
    if (strand === "all" || post.dataset.strand === strand) {
      post.style.display = "block";
    } else {
      post.style.display = "none";
    }
  });
}

if (strandFilters) {
  strandFilters.addEventListener("click", (event) => {
    const button = event.target.closest(".filter");
    if (!button) return;

    strandFilters.querySelectorAll(".filter").forEach((item) => {
      item.classList.remove("active");
    });

    button.classList.add("active");
    applyFilter(button.dataset.strand);
  });
}

const postForm = document.getElementById("post-form");
const feed = document.querySelector(".feed");

if (postForm && feed) {
  postForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(postForm);
    const title = formData.get("title").trim();
    const body = formData.get("body").trim();
    const strand = formData.get("strand");

    if (!title || !body) return;

    const strandLabel = strand === "all" ? "S Society" : `${strand} ${strandName(strand)}`;

    const article = document.createElement("article");
    article.className = "post card";
    article.dataset.strand = strand === "all" ? "S" : strand;
    article.innerHTML = `
      <div class="post-header">
        <div>
          <p class="post-author">You</p>
          <p class="post-role">Changemaker</p>
        </div>
        <span class="strand">${strandLabel}</span>
      </div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(body)}</p>
      <div class="post-actions">
        <button class="ghost">Applaud</button>
        <button class="ghost">Comment</button>
        <button class="ghost">Bridge</button>
      </div>
    `;

    const firstPost = feed.querySelector(".post");
    if (firstPost) {
      feed.insertBefore(article, firstPost);
    } else {
      feed.appendChild(article);
    }

    posts.unshift(article);
    postForm.reset();
    applyFilter("all");
    strandFilters?.querySelectorAll(".filter").forEach((item) => {
      item.classList.remove("active");
    });
    strandFilters?.querySelector(".filter")?.classList.add("active");
  });
}

function strandName(strand) {
  switch (strand) {
    case "N":
      return "Nature";
    case "E":
      return "Economy";
    case "S":
      return "Society";
    case "W":
      return "Wellbeing";
    default:
      return "Society";
  }
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const bridgeForm = document.getElementById("bridge-form");
const bridgeResults = document.getElementById("bridge-results");

if (bridgeForm && bridgeResults) {
  bridgeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(bridgeForm);
    const need = formData.get("need").trim();
    const skill = formData.get("skill").trim();

    if (!need || !skill) return;

    const suggestions = [
      `Matched a youth council with experience in ${need}.`,
      `Found a peer mentor group offering ${skill}.`,
      `Suggested a partner school that needs ${skill} and can support ${need}.`,
    ];

    bridgeResults.innerHTML = `
      <p><strong>Bridge suggestions</strong></p>
      <ul>
        ${suggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    `;

    bridgeForm.reset();
  });
}
