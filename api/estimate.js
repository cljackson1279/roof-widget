async function bestGeoMatch(sb, client, { zip, city, county, state }) {
  // ZIP
  if (zip) {
    const { data } = await sb
      .from("geo_factors")
      .select("base_mult, material_mult")
      .eq("level", "zip")
      .eq("zip", zip)
      .maybeSingle();
    if (data) return data;
  }

  // City+State
  if (city && state) {
    const { data } = await sb
      .from("geo_factors")
      .select("base_mult, material_mult")
      .eq("level", "city_state")
      .eq("city", city)
      .eq("state", state)
      .maybeSingle();
    if (data) return data;
  }

  // County+State
  if (county && state) {
    const { data } = await sb
      .from("geo_factors")
      .select("base_mult, material_mult")
      .eq("level", "county_state")
      .eq("county", county)
      .eq("state", state)
      .maybeSingle();
    if (data) return data;
  }

  // State
  if (state) {
    const { data } = await sb
      .from("geo_factors")
      .select("base_mult, material_mult")
      .eq("level", "state")
      .eq("state", state)
      .maybeSingle();
    if (data) return data;
  }

  return null;
}
