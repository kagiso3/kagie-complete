"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { testimonials } from "@/lib/content";
import { SectionHeading } from "./ui";

export function Testimonials() {
  const [index, setIndex] = useState(0);
  const stories = testimonials.map((_, offset) => testimonials[(index + offset) % testimonials.length]);
  return <section className="testimonials-section" aria-label="Student stories" data-reveal>
    <SectionHeading>Loved by Students Across South Africa <Heart className="heading-heart" size={22} fill="currentColor" /></SectionHeading>
    <div className="testimonials-layout">
      <button className="carousel-button" aria-label="Previous student story" onClick={() => setIndex(value => (value + testimonials.length - 1) % testimonials.length)}><ChevronLeft size={20} /></button>
      <div className="testimonials-grid" aria-live="polite" aria-atomic="true">{stories.map(story => <figure key={story.name} className="testimonial">
        <div className="student-avatar" style={{ backgroundImage: "url('/images/student-portraits.webp')", backgroundSize: "300% 100%", backgroundPosition: `${story.portrait * 50}% center` }} aria-hidden="true" />
        <div><blockquote>“{story.quote}”</blockquote><figcaption><strong>{story.name}</strong><span>{story.city}</span></figcaption></div>
      </figure>)}</div>
      <button className="carousel-button" aria-label="Next student story" onClick={() => setIndex(value => (value + 1) % testimonials.length)}><ChevronRight size={20} /></button>
    </div>
    <div className="carousel-dots">{testimonials.map((story, i) => <button key={story.name} aria-label={`Show ${story.name}’s story`} aria-pressed={index === i} onClick={() => setIndex(i)} className={index === i ? "active" : ""} />)}</div>
  </section>;
}
