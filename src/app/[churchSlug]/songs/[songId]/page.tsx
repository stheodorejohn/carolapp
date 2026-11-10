import SongDetailPage from '@/app/songs/[songId]/page';

export default function ChurchSongDetailPage(props: { params: Promise<{ churchSlug: string; songId: string }> }) {
  return <SongDetailPage params={props.params as any} />;
}

