# Legal considerations for Karouselmaker

This document outlines main legal risks for the app and how they are (or can be) addressed. It is not legal advice; consult a lawyer for your jurisdiction and business model.

---

## 1. **Copyright – images from the web (Brave Search)**

**Risk:** Brave returns images from the open web. Many are copyrighted. Users who put those images in carousels and publish them may be reproducing/distributing works without a licence.

**What you already do:**
- Terms state that users are **solely responsible** for attribution and licensing of third-party images; you don’t guarantee licensing of third-party content.
- Unsplash: you comply with their API (attribution + download tracking) and surface attribution in the app and in exports.
- You flag some content as `license_hint: "likely_copyrighted"` (e.g. fictional characters); this can be shown in the UI so users are informed.

**How to strengthen:**
- In the UI, when a user selects or keeps a **Brave**-sourced image, show a short notice: *“This image is from the web and may be subject to copyright. You are responsible for ensuring you have the right to use it.”*
- Optionally show the “likely_copyrighted” hint in the editor for fictional/character images so users know to be careful.
- Keep a clear “User is responsible for licensing” line in Terms (you already do).

---

## 2. **Right of publicity (likenesses)**

**Risk:** Using photos of athletes, celebrities, or other identifiable people in **commercial** or **promotional** carousels (ads, sponsored posts, endorsements) can violate right of publicity in some US states and other countries.

**What you already do:**
- Acceptable Use forbids violating “any law or third-party rights.”

**How to strengthen:**
- In Terms (User responsibilities or Acceptable Use), add explicitly: *“When you use images of identifiable people (e.g. athletes, celebrities), you are responsible for obtaining any rights needed for your use, including for commercial or promotional purposes.”*
- You don’t need to police every image; making the obligation clear in Terms and in any “use at your own risk” notice is the main step.

---

## 3. **DMCA and safe harbor (user content)**

**Risk:** If you **host** or **distribute** user-generated content (e.g. public gallery, shared export links, or anything that makes carousels available to the public on your domain), US DMCA safe harbor (17 U.S.C. § 512) can protect you from copyright liability—**if** you meet its requirements (designated agent, takedown process, repeat-infringer policy).

**What you already do:**
- Terms and Privacy describe your use of data and third-party content; no DMCA section yet.

**How to strengthen:**
- Add a **DMCA / Copyright** page with:
  - Designated agent (name, address, email) for copyright notices.
  - How to send a valid takedown notice (what must be included).
  - Counter-notice process.
  - Statement that you may terminate repeat infringers.
- In Terms, add a short section: *“We respond to valid DMCA notices. See our Copyright/DMCA page for how to report infringement and our designated agent.”*
- If you don’t host public user content, safe harbor is less critical, but having a DMCA page and agent is still good practice and expected by many providers.

---

## 4. **AI-generated content – accuracy and defamation**

**Risk:** AI can generate false or defamatory statements about real people (e.g. in “top 10” or news-style carousels). Publishing that content can create liability for the **user** (and in some theories, for the platform).

**What you already do:**
- Terms disclaim “accuracy of AI-generated content” and state that the user is responsible for how they use exported content.

**How to strengthen:**
- In Terms (Disclaimers or User responsibilities), add: *“You should verify the accuracy of AI-generated or edited content before publishing. We are not liable for defamation, inaccuracy, or other harm arising from content generated or modified through the Service.”*
- In-app, you can add a short reminder near export/publish: “Verify facts and rights before publishing.”

---

## 5. **Privacy (GDPR, CCPA, etc.)**

**Risk:** You collect account data, content, and usage data; you use Supabase, OpenAI, Unsplash, Brave. Regulators expect clear notices, lawful bases, and user rights.

**What you already do:**
- Privacy Policy describes what you collect, how you use it, and third-party services.
- Terms reference the Privacy Policy and data processing.

**How to strengthen:**
- If you have EU/UK users: state lawful basis (e.g. contract, legitimate interest) and mention right to access, rectification, erasure, portability, and to object/complain to a supervisor.
- If you have California users: mention CCPA rights (know, delete, correct, opt-out of sale if applicable; note if you don’t sell data).
- Keep Privacy and Terms in sync with actual data flows (e.g. any new AI or image providers).

---

## 6. **Age and jurisdiction**

**Risk:** Some jurisdictions restrict who can use digital services or require parental consent for minors.

**What you already do:**
- No explicit age or jurisdiction clause.

**How to strengthen:**
- In Terms, add: *“You must be at least 13 (or 16 in the EEA, if we rely on consent for processing) to use the Service. You may not use the Service where it would be illegal or prohibited.”* Adjust ages with legal advice.

---

## 7. **Summary table**

| Area              | Risk                          | Main mitigation                                      |
|-------------------|-------------------------------|------------------------------------------------------|
| Copyright (images)| Use of web images without licence | User responsibility in Terms; Unsplash compliance; optional in-app notice for Brave images. |
| Publicity rights  | Use of likenesses in ads      | Explicit user responsibility in Terms.               |
| DMCA              | Hosting/distributing UGC       | DMCA page + designated agent + Terms reference.       |
| AI / defamation   | False or harmful AI content   | Disclaimers + “verify before publishing” in Terms/UI.|
| Privacy           | GDPR, CCPA                    | Privacy Policy + rights + lawful basis.               |
| Age / jurisdiction| Minors, prohibited use       | Age and jurisdiction clause in Terms.                 |

---

## 8. **Suggested next steps**

1. **Terms:** Add one sentence on right of publicity; one on verifying AI content; optional age/jurisdiction; reference to DMCA/Copyright page.
2. **DMCA/Copyright page:** Publish a page with designated agent and takedown/counter-notice instructions; link from Terms and footer.
3. **UI:** Optional short notice when a Brave (or non-Unsplash) image is selected: “Image from the web; you are responsible for rights and attribution.”
4. **Privacy:** If you target EU/California, add the relevant rights and bases (and “no sale” if true).
5. **Legal review:** Have a lawyer review Terms, Privacy, and DMCA page for your exact product and jurisdictions.
