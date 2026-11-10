import LiveTrackingPage from '@/app/live/[groupId]/page';

export default function ChurchLiveTrackingPage(props: { params: Promise<{ churchSlug: string; groupId: string }> }) {
  return <LiveTrackingPage params={props.params as any} />;
}

