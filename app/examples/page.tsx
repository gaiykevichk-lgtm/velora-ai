import { SiteHeader, SiteFooter } from '../site-content';
import { ExampleGallery } from '../example-gallery';
export const metadata={title:'AI Photography Showcase — Velora',description:'Eight original AI-generated 2K photographs across portrait, product, landscape, architecture, automotive, food, macro and street photography.'};
export default function ExamplesPage(){return <div className="landing"><SiteHeader/><main><ExampleGallery/></main><SiteFooter/></div>;}
