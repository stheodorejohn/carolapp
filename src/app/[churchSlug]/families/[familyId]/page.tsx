import FamilyDetailPage from '@/app/families/[familyId]/page';

export default function ChurchFamilyDetailPage(props: { params: Promise<{ churchSlug: string; familyId: string }> }) {
  return <FamilyDetailPage params={props.params as any} />;
}

