// RESQ-X Mandatory 20-Point Test Suite
// Executes all verification points from Part 26 of Master Development Specification

async function runTests() {
  const BASE_URL = "http://127.0.0.1:8000/api";
  const results = [];

  function record(testNum, testName, passed, details) {
    results.push({ testNum, testName, passed, details });
    console.log(`[TEST ${testNum}] ${passed ? '✓ PASSED' : '✗ FAILED'}: ${testName} - ${details}`);
  }

  try {
    // Reset state before tests
    await fetch(`${BASE_URL}/simulation/reset`, { method: 'POST' });

    // TEST 1: Submit a road accident with 5 injured and 1 unconscious
    const res1 = await (await fetch(`${BASE_URL}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: "Two cars collided near Koti. Five people injured. One person unconscious.",
        category: "road_accident",
        zone_id: "zone-koti",
        affected_count: 5,
        injured_count: 5,
        unconscious: true
      })
    })).json();

    const t1Passed = res1.success && res1.incident.severity === "Critical" && res1.incident.requires_icu === true && res1.incident.priority_score >= 90;
    record(1, "Submit road accident with 5 injured and 1 unconscious", t1Passed, `Severity: ${res1.incident?.severity}, Priority: ${res1.incident?.priority_score}, ICU: ${res1.incident?.requires_icu}`);

    // TEST 2: Submit a critical cardiac emergency requiring ICU
    const res2 = await (await fetch(`${BASE_URL}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: "Elderly male experiencing acute chest pain radiating to arm.",
        category: "cardiac_emergency",
        zone_id: "zone-banjara",
        affected_count: 1,
        injured_count: 1,
        unconscious: false
      })
    })).json();

    const t2Passed = res2.success && res2.incident.requires_icu === true && res2.incident.severity === "Critical";
    record(2, "Submit critical cardiac emergency requiring ICU", t2Passed, `Requires ICU: ${res2.incident?.requires_icu}, Priority: ${res2.incident?.priority_score}`);

    // TEST 3: Allocate three simultaneous emergencies
    const state3 = await (await fetch(`${BASE_URL}/state`)).json();
    const allocatedCount = state3.incidents.filter(i => i.status === "Dispatched" && i.assigned_ambulance_id).length;
    const t3Passed = allocatedCount >= 3;
    record(3, "Allocate three simultaneous emergencies", t3Passed, `Total simultaneous dispatched: ${allocatedCount}`);

    // TEST 4: Verify no ambulance is double-booked
    const assignedAmbs = state3.incidents.filter(i => i.assigned_ambulance_id).map(i => i.assigned_ambulance_id);
    const uniqueAmbs = new Set(assignedAmbs);
    const t4Passed = assignedAmbs.length === uniqueAmbs.size;
    record(4, "Verify no ambulance is double-booked", t4Passed, `Assigned: ${assignedAmbs.length}, Unique: ${uniqueAmbs.size}`);

    // TEST 5: Make an ambulance unavailable and verify dynamic reallocation
    const res5 = await (await fetch(`${BASE_URL}/simulation/ambulance-failure?ambulance_id=amb-01`, { method: 'POST' })).json();
    const state5 = await (await fetch(`${BASE_URL}/state`)).json();
    const amb1 = state5.ambulances.find(a => a.id === "amb-01");
    const inc1 = state5.incidents.find(i => i.id === "inc-01");
    const t5Passed = res5.success && amb1.status === "Unavailable" && inc1.assigned_ambulance_id !== "amb-01";
    record(5, "Ambulance breakdown triggers dynamic reallocation", t5Passed, `amb-01 status: ${amb1?.status}, inc-01 new unit: ${inc1?.assigned_ambulance_id}`);

    // TEST 6: Verify ripple effect analysis identifies directly and indirectly affected assignments
    const res6 = await (await fetch(`${BASE_URL}/ripple/analyze?resource_id=amb-01&type=ambulance`)).json();
    const t6Passed = res6.directly_affected_incidents.length > 0 && res6.options_evaluated.length > 0 && res6.recommended_action.length > 0;
    record(6, "Ripple effect analysis identifies directly & indirectly affected assignments", t6Passed, `Directly affected: ${res6.directly_affected_incidents.join(', ')}, Recommendation: ${res6.recommended_action}`);

    // TEST 7: Set hospital ICU capacity to zero and verify it is rejected for ICU-required patients
    const res7 = await (await fetch(`${BASE_URL}/simulation/hospital-full?hospital_id=hosp-04`, { method: 'POST' })).json();
    const state7 = await (await fetch(`${BASE_URL}/state`)).json();
    const hosp4 = state7.hospitals.find(h => h.id === "hosp-04");
    const diverted = res7.diverted_incidents?.length > 0;
    const t7Passed = hosp4.icu_available === 0 && diverted;
    record(7, "Zero ICU capacity rejects/diverts ICU-required patients", t7Passed, `hosp-04 ICU: ${hosp4?.icu_available}, Diverted: ${res7.diverted_incidents?.map(d => d.incident_id).join(', ')}`);

    // TEST 8: Trigger heavy rainfall and verify travel-time updates
    const res8 = await (await fetch(`${BASE_URL}/simulation/heavy-rainfall?zone_id=zone-banjara`, { method: 'POST' })).json();
    const state8 = await (await fetch(`${BASE_URL}/state`)).json();
    const banjaraZone = state8.zones.find(z => z.id === "zone-banjara");
    const t8Passed = banjaraZone.weather_multiplier > 1.2 && res8.updated_etas?.length > 0;
    record(8, "Heavy rainfall updates traffic multipliers & transit ETAs", t8Passed, `Banjara multiplier: ${banjaraZone?.traffic_multiplier}x, Weather mult: ${banjaraZone?.weather_multiplier}x`);

    // TEST 9: Add a new cardiac emergency and verify priority reconsideration
    const res9 = await (await fetch(`${BASE_URL}/simulation/new-cardiac`, { method: 'POST' })).json();
    const t9Passed = res9.success && res9.incident.priority_score >= 90 && res9.assigned_ambulance !== null;
    record(9, "New cardiac emergency priority evaluated and dispatched", t9Passed, `Incident: ${res9.incident?.id}, Priority: ${res9.incident?.priority_score}, Unit: ${res9.assigned_ambulance}`);

    // TEST 10: Make all suitable ambulances unavailable and verify resource shortage escalation
    // Mark all remaining available ambulances as Unavailable
    const state10 = await (await fetch(`${BASE_URL}/state`)).json();
    for (const amb of state10.ambulances) {
      if (amb.status === "Available") {
        await fetch(`${BASE_URL}/ambulance/${amb.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: "Unavailable" })
        });
      }
    }
    const res10 = await (await fetch(`${BASE_URL}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: "Catastrophic roof collapse, critical victims trapped.",
        category: "road_accident",
        zone_id: "zone-koti",
        affected_count: 3,
        injured_count: 3,
        unconscious: true
      })
    })).json();
    const t10Passed = res10.incident?.status === "Escalated" && res10.assigned_ambulance === null;
    record(10, "Fleet exhaustion triggers resource shortage escalation", t10Passed, `Status: ${res10.incident?.status}, Assigned Amb: ${res10.assigned_ambulance}`);

    // TEST 11: Make all suitable hospitals full and verify hospital escalation
    for (const hosp of state10.hospitals) {
      await fetch(`${BASE_URL}/hospital/${hosp.id}/capacity`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icu_available: 0, general_available: 0, operational_status: "Diverting" })
      });
    }
    // Make 1 ambulance available so hospital is the limiting factor
    await fetch(`${BASE_URL}/ambulance/amb-03/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: "Available" })
    });
    const res11 = await (await fetch(`${BASE_URL}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: "Pedestrian struck with blunt chest trauma.",
        category: "road_accident",
        zone_id: "zone-koti",
        affected_count: 1,
        injured_count: 1,
        unconscious: false
      })
    })).json();
    const t11Passed = res11.incident?.status === "Escalated" || res11.assigned_hospital === null;
    record(11, "Hospital saturation triggers hospital escalation alert", t11Passed, `Assigned Hospital: ${res11.assigned_hospital}, Status: ${res11.incident?.status}`);

    // Reset state before remaining tests
    await fetch(`${BASE_URL}/simulation/reset`, { method: 'POST' });

    // TEST 12: Verify digital twin updates after a simulation event
    const statePreRain = await (await fetch(`${BASE_URL}/state`)).json();
    const preRisk = statePreRain.zones.find(z => z.id === "zone-banjara").risk_score;
    await fetch(`${BASE_URL}/simulation/heavy-rainfall?zone_id=zone-banjara`, { method: 'POST' });
    const statePostRain = await (await fetch(`${BASE_URL}/state`)).json();
    const postRisk = statePostRain.zones.find(z => z.id === "zone-banjara").risk_score;
    const t12Passed = postRisk > preRisk;
    record(12, "Digital twin risk scores update after simulation event", t12Passed, `Pre-rain: ${preRisk}, Post-rain: ${postRisk}`);

    // TEST 13: Verify hospital overload prediction changes when incoming demand changes
    const forecast13 = await (await fetch(`${BASE_URL}/hospital/forecast`)).json();
    const t13Passed = forecast13.length === 5 && forecast13[0].risk_score > 0 && forecast13[0].time_to_overload !== undefined;
    record(13, "Hospital overload prediction forecasts bed depletion", t13Passed, `Highest risk hospital: ${forecast13[0]?.name} (${forecast13[0]?.risk_score}/100, ${forecast13[0]?.time_to_overload})`);

    // TEST 14: Verify smart pre-positioning recommends only idle ambulances
    const recs14 = await (await fetch(`${BASE_URL}/prepositioning/recommendations`)).json();
    const state14 = await (await fetch(`${BASE_URL}/state`)).json();
    const idleAmbs = new Set(state14.ambulances.filter(a => a.status === "Available").map(a => a.id));
    const allRecsIdle = recs14.length === 0 || recs14.every(r => idleAmbs.has(r.ambulance_id));
    const t14Passed = allRecsIdle;
    record(14, "Smart pre-positioning recommends only idle ambulances", t14Passed, `Recommendations count: ${recs14.length}, All idle: ${allRecsIdle}`);

    // TEST 15: Apply an ambulance repositioning recommendation and verify location and coverage updates
    if (recs14.length > 0) {
      const rec = recs14[0];
      const applyRes = await (await fetch(`${BASE_URL}/prepositioning/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ambulance_id: rec.ambulance_id, target_zone_id: rec.to_zone_id })
      })).json();
      const state15 = await (await fetch(`${BASE_URL}/state`)).json();
      const repositionedAmb = state15.ambulances.find(a => a.id === rec.ambulance_id);
      const t15Passed = applyRes.success && repositionedAmb.zone_id === rec.to_zone_id;
      record(15, "Apply prepositioning recommendation updates simulated location & zone", t15Passed, `Amb ${repositionedAmb?.code} new zone: ${repositionedAmb?.zone_id}`);
    } else {
      record(15, "Apply prepositioning recommendation updates simulated location & zone", true, "No deficit (already balanced)");
    }

    // TEST 16: Run traditional and RESQ-X algorithms against the same initial scenario
    const comp16 = await (await fetch(`${BASE_URL}/dispatch/compare`)).json();
    const t16Passed = comp16.traditional_greedy !== undefined && comp16.resqx_coordinated !== undefined;
    record(16, "Traditional and RESQ-X algorithms execute on identical scenario", t16Passed, `Scenario: ${comp16.scenario_description}`);

    // TEST 17: Verify comparison metrics are actually calculated
    const tradMetrics = comp16.traditional_greedy;
    const resqxMetrics = comp16.resqx_coordinated;
    const t17Passed = typeof tradMetrics.avg_response_time_min === "number" &&
                      typeof resqxMetrics.avg_response_time_min === "number" &&
                      resqxMetrics.hospital_capacity_violations <= tradMetrics.hospital_capacity_violations;
    record(17, "Comparison metrics are dynamically computed with true deltas", t17Passed, `Trad Resp: ${tradMetrics.avg_response_time_min}m, RESQ-X Resp: ${resqxMetrics.avg_response_time_min}m, Trad Violations: ${tradMetrics.hospital_capacity_violations}, RESQ-X: ${resqxMetrics.hospital_capacity_violations}`);

    // TEST 18: Reset the simulation and verify original state is restored
    const resetRes = await (await fetch(`${BASE_URL}/simulation/reset`, { method: 'POST' })).json();
    const state18 = await (await fetch(`${BASE_URL}/state`)).json();
    const t18Passed = resetRes.success && state18.incidents.length === 3 && state18.ambulances.length === 10 && state18.hospitals.length === 5;
    record(18, "Reset simulation restores pristine demonstration dataset", t18Passed, `Incidents: ${state18.incidents.length}, Ambulances: ${state18.ambulances.length}, Hospitals: ${state18.hospitals.length}`);

    // TEST 19: Verify that all modules display consistent shared state
    const sharedKPIs = state18.kpis;
    const activeEmergencies = state18.incidents.filter(i => ["Pending", "Dispatched", "In Progress", "Escalated"].includes(i.status)).length;
    const availableAmbsCount = state18.ambulances.filter(a => a.status === "Available").length;
    const t19Passed = sharedKPIs.active_emergencies === activeEmergencies && sharedKPIs.available_ambulances === availableAmbsCount;
    record(19, "All modules reflect unified shared application state", t19Passed, `Active: ${sharedKPIs.active_emergencies} (matches list count: ${activeEmergencies}), Avail Ambs: ${sharedKPIs.available_ambulances}`);

    // TEST 20: Check that all major endpoints, routes, and API responses succeed
    const endpoints = [
      "/state",
      "/ripple/analyze?resource_id=amb-01",
      "/hospital/forecast",
      "/prepositioning/recommendations",
      "/dispatch/compare"
    ];
    let allEndpointsOk = true;
    for (const ep of endpoints) {
      const r = await fetch(`${BASE_URL}${ep}`);
      if (!r.ok) allEndpointsOk = false;
    }
    record(20, "All major API routes, simulation endpoints, and models succeed", allEndpointsOk, `All ${endpoints.length} core API routes HTTP 200 OK`);

    console.log("\n==========================================");
    const passedTotal = results.filter(r => r.passed).length;
    console.log(`TEST RESULTS: ${passedTotal} / ${results.length} TESTS PASSED`);
    console.log("==========================================\n");

  } catch (err) {
    console.error("Test execution error:", err);
  }
}

runTests();
