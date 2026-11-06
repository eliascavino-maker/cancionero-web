import { render, screen, waitFor } from '@testing-library/react';
import { logoPath, removeLogo, setLogo, shrinkLogo, useBandLogo } from './logo';

const calls: string[] = [];
let rpcError: { message: string } | null = null;
let uploadError: { message: string } | null = null;
const download = vi.fn();
const client = {
  storage: {
    from: (bucket: string) => ({
      upload: async (path: string, _blob: Blob, opts: { contentType: string }) => {
        calls.push(`upload ${bucket} ${path} ${opts.contentType}`);
        return { error: uploadError };
      },
      remove: async (paths: string[]) => {
        calls.push(`remove ${paths.join(',')}`);
        return { error: null };
      },
      download: (path: string) => download(path),
    }),
  },
  rpc: async (name: string, args: Record<string, unknown>) => {
    calls.push(`rpc ${name} ${args.path}`);
    return { error: rpcError };
  },
};
const cloud: { client: unknown; band: { bandId: string; logoPath?: string | null } | null } = { client, band: null };
vi.mock('./CloudProvider', () => ({ useCloud: () => cloud }));

beforeEach(() => {
  calls.length = 0;
  rpcError = null;
  uploadError = null;
  download.mockReset();
  localStorage.clear();
  vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
});
afterEach(() => vi.restoreAllMocks());

const webp = new Blob(['img'], { type: 'image/webp' });

it('a new name each time, in the band folder', () => {
  expect(logoPath('b1', 'image/webp', 5)).toBe('b1/logo-5.webp');
  expect(logoPath('b1', 'image/png', 5)).toBe('b1/logo-5.png');
});

it('setLogo: upload, make it the band logo, delete the old one', async () => {
  await setLogo(client as never, 'b1', 'b1/logo-1.webp', webp);
  expect(calls).toEqual([
    'upload band-logos b1/logo-1700000000000.webp image/webp',
    'rpc set_band_logo b1/logo-1700000000000.webp',
    'remove b1/logo-1.webp',
  ]);
});

it('setLogo: if the band refuses it, the new file is deleted', async () => {
  rpcError = { message: 'Solo el owner puede hacer esto' };
  await expect(setLogo(client as never, 'b1', null, webp)).rejects.toThrow('Solo el owner');
  expect(calls.at(-1)).toBe('remove b1/logo-1700000000000.webp');
});

it('setLogo: without migration 9 says so', async () => {
  uploadError = { message: 'Bucket not found' };
  await expect(setLogo(client as never, 'b1', null, webp)).rejects.toThrow('Falta la migración 9');
});

it('removeLogo: off the band, then the file', async () => {
  await removeLogo(client as never, 'b1', 'b1/logo-1.webp');
  expect(calls).toEqual(['rpc set_band_logo null', 'remove b1/logo-1.webp']);
});

it('shrinkLogo: only pictures (no SVG)', async () => {
  await expect(shrinkLogo(new Blob(['<svg/>'], { type: 'image/svg+xml' }))).rejects.toThrow('PNG, JPG o WebP');
});

function Show() {
  const logo = useBandLogo();
  return logo ? <img alt="logo" src={logo} /> : <span>sin logo</span>;
}

it('useBandLogo: downloaded once, kept on the device, forgotten when taken off', async () => {
  cloud.band = { bandId: 'b1', logoPath: 'b1/logo-1.webp' };
  download.mockResolvedValue({ data: webp, error: null });
  const { unmount } = render(<Show />);
  await waitFor(() => expect(screen.getByRole('img', { name: 'logo' })).toHaveAttribute('src', expect.stringMatching(/^data:image\/webp;base64,/)));
  expect(download).toHaveBeenCalledWith('b1/logo-1.webp');
  unmount();

  // Again (or offline): from the device.
  download.mockClear();
  const again = render(<Show />);
  expect(screen.getByRole('img', { name: 'logo' })).toBeInTheDocument();
  expect(download).not.toHaveBeenCalled();
  again.unmount();

  cloud.band = { bandId: 'b1', logoPath: null };
  render(<Show />);
  expect(screen.getByText('sin logo')).toBeInTheDocument();
  expect(localStorage.getItem('cancionero.logo')).toBeNull();
});

it('useBandLogo: something that is not a picture is not shown', async () => {
  cloud.band = { bandId: 'b1', logoPath: 'b1/logo-2.webp' };
  download.mockResolvedValue({ data: new Blob(['<svg/>'], { type: 'image/svg+xml' }), error: null });
  render(<Show />);
  await waitFor(() => expect(download).toHaveBeenCalled());
  await new Promise((r) => setTimeout(r, 20));
  expect(screen.getByText('sin logo')).toBeInTheDocument();
});
