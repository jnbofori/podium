import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import { DECK_TEXT_LIMIT, truncateDeckText } from '@/lib/podium';

export const runtime = 'nodejs';
export const revalidate = 0;

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function extractTextFromSlideXml(xml: string): string {
  const texts: string[] = [];
  const regex = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    const value = match[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
    if (value) texts.push(value);
  }
  return texts.join(' ').replace(/\s+/g, ' ').trim();
}

function slideSortKey(path: string): number {
  const match = path.match(/slide(\d+)\.xml$/i);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing PowerPoint file' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pptx')) {
      return NextResponse.json({ error: 'Only .pptx files are supported' }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File must be under 20MB' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files)
      .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
      .sort((a, b) => slideSortKey(a) - slideSortKey(b));

    if (slideFiles.length === 0) {
      return NextResponse.json({ error: 'No slides found in this PowerPoint' }, { status: 400 });
    }

    const slides = [];
    for (let i = 0; i < slideFiles.length; i++) {
      const xml = await zip.files[slideFiles[i]].async('string');
      const text = extractTextFromSlideXml(xml);
      slides.push({
        index: i + 1,
        text: text || '(No extractable text on this slide)',
      });
    }

    const plainText = truncateDeckText(
      slides.map((slide) => `Slide ${slide.index}:\n${slide.text}`).join('\n\n'),
      DECK_TEXT_LIMIT
    );

    return NextResponse.json({
      slides,
      plainText,
      slideCount: slides.length,
      fileName: file.name,
    });
  } catch (error) {
    console.error('Failed to parse PPTX', error);
    return NextResponse.json({ error: 'Failed to parse PowerPoint file' }, { status: 500 });
  }
}
