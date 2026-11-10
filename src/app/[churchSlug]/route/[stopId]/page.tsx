import RouteStopPage from '@/app/route/[stopId]/page';

export default function ChurchRouteStopPage(props: { params: Promise<{ churchSlug: string; stopId: string }> }) {
  return <RouteStopPage params={props.params as any} />;
}

