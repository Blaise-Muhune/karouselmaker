import { escapeEmailHtml } from "./transactional";

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || "https://karouselmaker.com").replace(/\/$/, "");

function emailFrame(content: string) {
  return `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#14231c;max-width:560px;margin:0 auto;padding:24px"><p style="font-weight:700;font-size:18px;margin:0 0 20px">KarouselMaker</p>${content}</div>`;
}

export function welcomeEmail() {
  return {
    subject: "Your first carousel starts here",
    text: "Welcome to KarouselMaker. Create a project, choose a topic, and generate an editable carousel when you are ready. Start creating: " + appUrl() + "/projects/new",
    html: emailFrame(`<p>Welcome to KarouselMaker.</p><p>Create a project, choose a topic, and generate an editable carousel when you are ready.</p><p><a href="${appUrl()}/projects/new" style="color:#008f61">Create your first project</a></p>`),
  };
}

export function subscriptionActivatedEmail(plan: "creator" | "growth") {
  const planName = plan === "growth" ? "Growth" : "Creator";
  return {
    subject: `Your ${planName} plan is active`,
    text: `Your ${planName} plan is active. You can now create and export your carousels from your projects: ${appUrl()}/projects`,
    html: emailFrame(`<p>Your <strong>${planName}</strong> plan is active.</p><p>You can now create and export your carousels from your projects.</p><p><a href="${appUrl()}/projects" style="color:#008f61">Open projects</a></p>`),
  };
}

export function postPackEmail(credits: number) {
  return {
    subject: `${credits} post credits are ready`,
    text: `${credits} post credits were added to your KarouselMaker account. Create your next carousel: ${appUrl()}/projects`,
    html: emailFrame(`<p><strong>${credits} post credits</strong> were added to your KarouselMaker account.</p><p><a href="${appUrl()}/projects" style="color:#008f61">Create your next carousel</a></p>`),
  };
}

export function weeklyCreatorNoteEmail(unsubscribeUrl: string) {
  const safeUrl = escapeEmailHtml(unsubscribeUrl);
  return {
    subject: "One carousel idea for this week",
    text: `This week, make one carousel around a mistake your customer makes before they find your product. Slide 1: name the mistake. Slides 2–4: show the cost of it. Final slide: show the next step. Start a draft: ${appUrl()}/projects\n\nYou are receiving this weekly creator note because you opted in. Unsubscribe: ${unsubscribeUrl}`,
    html: emailFrame(`<p>This week, make one carousel around a mistake your customer makes before they find your product.</p><ol><li>Name the mistake on slide 1.</li><li>Show the cost of it on slides 2–4.</li><li>Show the next step on the final slide.</li></ol><p><a href="${appUrl()}/projects" style="color:#008f61">Start a draft</a></p><p style="font-size:12px;color:#607066">You are receiving this weekly creator note because you opted in. <a href="${safeUrl}" style="color:#607066">Unsubscribe</a>.</p>`),
  };
}
