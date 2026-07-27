const { initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");

initializeApp();
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

const db = getFirestore();

const STRAND_LABELS = {
  N: "Nature",
  E: "Economy",
  S: "Society",
  W: "Wellbeing",
};

const BOT_GUIDE = {
  id: "bridge-guide-bot",
  name: "Bridge Guide",
};

const BOT_SIGNAL = {
  id: "bridge-signal-bot",
  name: "Bridge Signal",
};

function buildCoachComment(post) {
  const strand = STRAND_LABELS[post.strand] || "Society";
  const tags = Array.isArray(post.tags) && post.tags.length
    ? `Tags picked up: ${post.tags.slice(0, 4).map((tag) => `#${tag}`).join(", ")}.`
    : "You can sharpen discovery even more by adding a few tags.";

  const guidanceByStrand = {
    N: "Invite people who can bring data, fieldwork, or partnerships with local environmental groups.",
    E: "Try calling out the business model, resource loop, or stakeholder group you need most right now.",
    S: "The strongest next step is often naming the community partner, audience, or organizing need directly.",
    W: "Wellbeing posts travel further when they mention the specific challenge, support format, or target group.",
  };

  return [
    `Bridge Signal here. Your post is now flowing into the ${strand} discovery layer.`,
    tags,
    guidanceByStrand[post.strand] || guidanceByStrand.S,
  ].join(" ");
}

exports.onProfileCreated = onDocumentCreated("profiles/{userId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const userId = event.params.userId;

  await db.collection("profiles").doc(userId).collection("notifications").add({
    type: "system",
    actor_name: BOT_GUIDE.name,
    actor_id: BOT_GUIDE.id,
    read: false,
    created_at: FieldValue.serverTimestamp(),
    message:
      "Welcome to Bridge. Complete your profile, follow a few changemakers, and publish your first post to wake up your personalized feed.",
  });
});

exports.onPostCreated = onDocumentCreated("posts/{postId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const postId = event.params.postId;
  const post = snapshot.data();
  if (!post || !post.author_id) return;

  if (String(post.author_id).startsWith("bridge-")) {
    return;
  }

  const commentText = buildCoachComment(post);
  const postRef = db.collection("posts").doc(postId);

  await postRef.collection("comments").add({
    author_id: BOT_SIGNAL.id,
    author_name: BOT_SIGNAL.name,
    author_avatar_url: "",
    text: commentText,
    created_at: FieldValue.serverTimestamp(),
  });

  await postRef.set(
    {
      comments_count: FieldValue.increment(1),
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await db.collection("profiles").doc(post.author_id).collection("notifications").add({
    type: "bot",
    actor_name: BOT_SIGNAL.name,
    actor_id: BOT_SIGNAL.id,
    post_id: postId,
    read: false,
    created_at: FieldValue.serverTimestamp(),
    message: "Bridge Signal analyzed your new post and left a coaching comment to help it travel further.",
  });
});
