import Image from 'next/image';
import Link from 'next/link';
import { examples } from '@/lib/examples';
export function ExampleGallery({compact=false}:{compact?:boolean}) {
 return <section className="ai-example-section" id="ai-examples" aria-labelledby="ai-examples-title">
  <div className="ai-example-heading"><div><span className="section-eyebrow">Made with AI · 2K showcase</span><h2 id="ai-examples-title" className="section-heading">One idea. Endless possibilities.</h2><p className="section-desc">Eight original AI-generated photographs. Explore a different creative direction in every frame.</p></div>{compact ? <Link className="btn-secondary" href="/examples">Explore all 8 ↗</Link>:<Link className="btn-secondary" href="/studio?mode=image">Open image studio ↗</Link>}</div>
  <div className="ai-example-grid">{(compact?examples.slice(0,4):examples).map((example)=><figure className="ai-example-card" key={example.title}><div className="ai-example-photo"><Image src={example.url} alt={example.alt} fill sizes="(max-width: 600px) 90vw, (max-width: 1000px) 45vw, 24vw" quality={80}/><span className="ai-example-badge">AI GENERATED</span></div><figcaption><span>{example.category}</span><h3>{example.title}</h3></figcaption></figure>)}</div>
  <p className="ai-example-note">Created with Gemini 3.1 Flash Image Preview via Promto. Showcase images are illustrative examples, not a guarantee of identical output from the studio’s configured model.</p>
 </section>;
}
