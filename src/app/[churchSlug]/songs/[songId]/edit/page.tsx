import EditSongPage from '@/app/songs/[songId]/edit/page';

export default function ChurchEditSongPage(props: { params: Promise<{ churchSlug: string; songId: string }> }) {
  return <EditSongPage params={props.params as any} />;
}

