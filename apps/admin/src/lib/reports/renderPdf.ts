import { toDocDefinition } from './pdfLayout.ts';
import type { ReportMeta, ReportModel } from './types.ts';

async function loadLogoDataUrl(): Promise<string | undefined> {
  try {
    const response = await fetch('/brand/trisakay-mark.png');
    if (!response.ok) return undefined;
    const blob = await response.blob();
    return await new Promise<string | undefined>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    });
  } catch {
    // A missing logo must not stop the report; the letterhead prints without the mark.
    return undefined;
  }
}

/**
 * Builds the report PDF in the browser and downloads it. pdfmake and its fonts are large, so they are loaded
 * here on demand and the normal admin bundle does not carry them.
 */
export async function downloadReportPdf(model: ReportModel, meta: ReportMeta, filename: string): Promise<void> {
  const [pdfMakeModule, fontsModule, logoDataUrl] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
    loadLogoDataUrl(),
  ]);
  // Depending on how the bundler wraps this CommonJS build, the library is the default export or the module itself.
  const pdfMake = pdfMakeModule.default ?? (pdfMakeModule as unknown as typeof pdfMakeModule.default);
  const vfs = (fontsModule as { default?: Record<string, string> }).default ?? (fontsModule as unknown as Record<string, string>);

  pdfMake.addVirtualFileSystem(vfs);
  await pdfMake.createPdf(toDocDefinition(model, meta, { logoDataUrl })).download(filename);
}
