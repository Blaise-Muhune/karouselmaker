"use client";

import { useState, useEffect } from "react";

const JOKES = [
  "This slide doesn't exist. The carousel decided to take a coffee break. ☕",
  "404: You swiped into the void. Legend says infinite templates live here. 🎠",
  "This page went to get milk. It's not coming back. 🥛",
  "Error 404: We've searched all 7 slides. This one isn't one of them.",
  "The carousel stopped here. The horses ran away. Again. 🐴",
  "You've discovered the gap between slides. Few have returned. ⚠️",
  "404: Even the best carousels have missing slides. This is ours.",
  "This page is loading... from 1998. 📞",
  "The slide you're looking for is in another carousel. 🍄",
  "404: We asked our AI. It said 'page not found.' So... yeah.",
  "This slide doesn't exist. But your next carousel could! 🚀",
  "You swiped too far. The carousel stopped here. Happens to the best of us. 🎠",
];

export function NotFoundJokes() {
  const [joke, setJoke] = useState(JOKES[0]);

  useEffect(() => {
    setJoke(JOKES[Math.floor(Math.random() * JOKES.length)]);
  }, []);

  return (
    <div className="rounded-xl border border-border/50 bg-muted/5 p-6">
      <p className="text-center text-foreground font-medium">
        &ldquo;{joke}&rdquo;
      </p>
      <p className="text-center text-xs text-muted-foreground mt-3">
        Refresh the page for another one
      </p>
    </div>
  );
}
