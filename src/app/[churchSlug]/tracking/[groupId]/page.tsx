import TrackingPage from '@/app/tracking/[groupId]/page';

export default function ChurchTrackingPage(props: { params: Promise<{ churchSlug: string; groupId: string }> }) {
  return <TrackingPage params={props.params as any} />;
}

