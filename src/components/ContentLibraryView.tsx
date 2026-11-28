import { ArtAlbum } from "./PostArt";
import React from "react";
import { UserProfile } from "../types";
import CalendarView from "./CalendarView";

interface ContentLibraryViewProps {
  profile: UserProfile | null;
  subscriptionStatus?: string;
  onNavigateToTab?: (tab: string) => void;
}

/**
 * Unified Content Library entry point.
 * Delegates to CalendarView's canonical Smart Content Library workspace
 * to keep planning, organization, scheduling, and publishing in one synchronized surface.
 */
export default function ContentLibraryView({
  profile,
  subscriptionStatus,
  onNavigateToTab,
}: ContentLibraryViewProps) {
  const [album, setAlbum] = React.useState(false);
  return (
    <>
      <div className="flex gap-3 p-3" aria-label="Content Library views"><button type="button" aria-pressed={!album} onClick={() => setAlbum(false)}>Content</button><button type="button" aria-pressed={album} onClick={() => setAlbum(true)}>Album</button></div>
      {album ? <ArtAlbum /> : <CalendarView
      profile={profile}
      subscriptionStatus={subscriptionStatus}
      onNavigateToTab={onNavigateToTab}
      initialSubView="library"
    />}
    </>
  );
}
