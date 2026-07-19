-- Real per-material content, replacing the reader's single shared mock page.
-- Structured the same way the reader already renders (heading/lead/body
-- paragraphs/pull-quote) so no UI redesign is needed — see DEV_LOG.md.
--
-- This is authored placeholder content standing in for real lecturer-
-- provided PDFs (none exist yet — see Feature 1's original assumption).
-- It is NOT extracted from any real file.

alter table public.materials add column content jsonb;

update public.materials set content = '{
  "heading": "Communal title and the mineral estate",
  "lead": "The Namibian legal order distinguishes the surface rights held communally under customary tenure from the mineral rights vested in the State. This distinction sits at the heart of every prospecting dispute since 1996.",
  "body": [
    "Article 100 of the Constitution vests all minerals and mineral rights in the State. The State may issue prospecting and mining licences subject to statutory conditions in the Minerals (Prospecting and Mining) Act 33 of 1992.",
    "Communal land, by contrast, is held by traditional authorities on behalf of the community. The Communal Land Reform Act 5 of 2002 codified this arrangement and introduced Land Boards as an oversight layer.",
    "The tension between these two regimes surfaces where a licence is granted over communally held land without prior consultation. Courts have consistently held that consultation is a procedural requirement — not a substantive veto — but the practical effect is often the same.",
    "Benefit-sharing agreements have emerged as the pragmatic bridge. A well-drafted agreement typically provides a percentage of gross royalties to the affected community, an employment quota, and a rehabilitation plan negotiated up-front."
  ],
  "pull": "Consultation is a procedural requirement, not a substantive veto."
}'::jsonb
where module_id = 'sen-301' and id = 'm1';

update public.materials set content = '{
  "heading": "Kxao Moses v. State: consultation without veto",
  "lead": "The case tested whether a prospecting licence issued over communal land without documented community consultation could stand, and what remedy follows when consultation is defective.",
  "body": [
    "The applicants, representing a San community in the Omaheke communal area, argued that the Ministry''s licence process had treated a single meeting with the traditional authority as sufficient consultation, without informing the wider community of the licence''s terms.",
    "The High Court held that the Minerals Act''s consultation requirement is procedural: the State must show that a genuine attempt at engagement occurred, but the outcome of that engagement does not bind the licensing decision. A community''s objection, however well-founded, is not a veto.",
    "The Court nonetheless set the licence aside on a narrower ground — the consultation record did not establish that the community had been given the licence''s actual coordinates and duration, only a general description of the area. Adequate notice, the Court found, is itself part of the procedural minimum.",
    "The judgment has since been read as establishing a two-part test: was the community informed of the specific terms of the proposed licence, and was there a genuine opportunity to respond before the decision was made. Both parts must be satisfied even though the community''s response need not be followed."
  ],
  "pull": "A community''s objection, however well-founded, is not a veto."
}'::jsonb
where module_id = 'sen-301' and id = 'm2';

update public.materials set content = '{
  "heading": "Tutorial 04 — discussion questions",
  "lead": "Prepare short written answers to the following before the seminar. Bring your Case Reader — we will work through the judgment paragraph by paragraph.",
  "body": [
    "1. What is the difference between a procedural consultation requirement and a substantive veto? Use the Kxao Moses judgment to illustrate your answer.",
    "2. The Court found the licence defective because the community was not told the exact coordinates and duration of the proposed area. Why might this detail matter more than the fact that a meeting took place at all?",
    "3. Communal land is held by traditional authorities on behalf of the community, while mineral rights vest in the State. Explain, in two paragraphs, why this split creates the specific dispute pattern seen in this chapter."
  ],
  "pull": "Bring your Case Reader — we will work through the judgment paragraph by paragraph."
}'::jsonb
where module_id = 'sen-301' and id = 'm3';

update public.materials set content = '{
  "heading": "The Walvis Bay corridor as a trade artery",
  "lead": "The Trans-Kalahari and Trans-Caprivi corridors route landlocked Botswana, Zambia and the DRC''s copper belt through the port of Walvis Bay, making corridor efficiency a regional, not merely national, economic question.",
  "body": [
    "Namibia''s port and road infrastructure investment since the early 2000s has been justified less by domestic freight volumes, which are modest, than by transit trade — goods that neither originate nor terminate within Namibia''s borders but pass through it.",
    "Tariff harmonisation under the SADC Free Trade Protocol has reduced formal barriers, but delays at border posts, differing axle-load standards, and inconsistent customs documentation continue to add cost. Traders frequently report that time lost at the Trans-Kalahari border post at Mamuno exceeds the time saved by the shorter route itself.",
    "Alongside the formal corridor, an informal cross-border trade in consumer goods persists, driven by small-scale traders whose volumes are individually tiny but collectively significant, and largely invisible to customs statistics."
  ],
  "pull": "Time lost at the border post frequently exceeds the time saved by the shorter route itself."
}'::jsonb
where module_id = 'eco-220' and id = 'm1';

update public.materials set content = '{
  "heading": "Seminar 06 — Border Economies",
  "lead": "This week''s slides summarise the corridor''s institutional architecture: the Walvis Bay Corridor Group, one-stop border posts, and the SADC Protocol on Trade.",
  "body": [
    "Key institution: the Walvis Bay Corridor Group (WBCG), a public-private partnership coordinating infrastructure investment and marketing the corridor to regional shippers.",
    "One-stop border posts (OSBPs) combine both countries'' customs and immigration functions into a single physical and procedural checkpoint, reducing the average crossing time — though implementation has been uneven across the region''s borders.",
    "The SADC Protocol on Trade commits members to phased tariff reduction, but rules of origin remain a persistent friction point, since goods assembled from imported components can struggle to qualify for preferential treatment."
  ],
  "pull": "One-stop border posts reduce average crossing time — though implementation has been uneven."
}'::jsonb
where module_id = 'eco-220' and id = 'm2';

update public.materials set content = '{
  "heading": "Tutorial notes — border economies",
  "lead": "Summary points raised in discussion, for revision before the test.",
  "body": [
    "Formal trade volume is easier to measure than informal trade, which biases official statistics toward understating the corridor''s real economic footprint.",
    "Infrastructure investment on its own does not guarantee reduced transit time if procedural bottlenecks at the border remain unaddressed.",
    "The corridor''s value to Namibia is largely indirect: port fees, transport services, and logistics employment, rather than the value of the transiting goods themselves."
  ],
  "pull": "Infrastructure investment alone does not guarantee reduced transit time."
}'::jsonb
where module_id = 'eco-220' and id = 'm3';

update public.materials set content = '{
  "heading": "Primary sources: the road to 1990",
  "lead": "This unit collects extracts from the 1982 Constitutional Principles, SWAPO''s founding documents, and UN Security Council Resolution 435, tracing the negotiated path to independence.",
  "body": [
    "The 1982 Constitutional Principles, agreed between the Western Contact Group and South Africa, pre-committed any future Namibian constitution to a multi-party system, an entrenched bill of rights, and an independent judiciary — commitments that shaped the 1990 Constituent Assembly''s work before it had even convened.",
    "Resolution 435 (1978) established the UN Transition Assistance Group (UNTAG) to supervise elections and the withdrawal of South African forces, but its implementation was delayed for over a decade by disputes linking Namibian independence to the withdrawal of Cuban troops from Angola.",
    "SWAPO''s transition from an armed liberation movement to a parliamentary party is itself a primary-source question: compare its 1976 political programme with its 1989 election manifesto to see how the movement''s stated priorities shifted once negotiated independence became achievable."
  ],
  "pull": "Commitments made in 1982 shaped the Constituent Assembly''s work before it had even convened."
}'::jsonb
where module_id = 'his-140' and id = 'm1';

update public.materials set content = '{
  "heading": "Unit 03 — Independence Era overview",
  "lead": "A timeline from the 1982 Principles to the 1990 Constitution, with the negotiating parties and their positions at each stage.",
  "body": [
    "1978: UNSC Resolution 435 adopted, establishing the framework for UN-supervised transition — implementation stalls.",
    "1988: The Tripartite Accord links Cuban withdrawal from Angola to South African withdrawal from Namibia, unblocking the process.",
    "1989: UNTAG-supervised elections held for the Constituent Assembly; SWAPO wins a majority but not the two-thirds needed to impose a constitution unilaterally, forcing genuine cross-party negotiation.",
    "1990: The Constituent Assembly adopts the Constitution by consensus, incorporating the 1982 Principles; independence declared 21 March 1990."
  ],
  "pull": "SWAPO''s majority fell short of two-thirds, forcing genuine cross-party negotiation."
}'::jsonb
where module_id = 'his-140' and id = 'm2';

update public.materials set content = '{
  "heading": "Essay: negotiated versus unilateral independence",
  "lead": "Due end of Unit 03. 1,500 words.",
  "body": [
    "\"Namibia''s independence constitution was shaped as much by what SWAPO could not do unilaterally as by what it wanted to do.\" Discuss, with reference to the two-thirds threshold in the 1989 Constituent Assembly election and the pre-agreed 1982 Constitutional Principles.",
    "Your answer should address at least two specific constitutional provisions that reflect this negotiated character, and explain what each party involved gained from the compromise.",
    "Use the primary sources from this unit as your evidentiary base; secondary literature should support, not replace, direct engagement with the 1982 Principles and the Constituent Assembly record."
  ],
  "pull": "What SWAPO could not do unilaterally shaped the constitution as much as what it wanted to do."
}'::jsonb
where module_id = 'his-140' and id = 'm3';

update public.materials set content = '{
  "heading": "Field guide: succulents of the Kalahari and Namib margins",
  "lead": "This chapter profiles plant species with documented traditional uses among communities in Namibia''s arid and semi-arid regions, alongside their botanical classification.",
  "body": [
    "Hoodia gordonii, a leafless succulent of the Apocynaceae family, has long been used by San communities to suppress hunger and thirst on extended hunting trips — a use that later attracted significant pharmaceutical research interest, raising early and influential questions about benefit-sharing with the communities holding the original knowledge.",
    "Welwitschia mirabilis, endemic to the Namib, is not itself widely used medicinally but is included here as a case study in longevity: individual plants are estimated to live over a thousand years, and its two permanent leaves — which never shed — offer a natural laboratory for studying arid adaptation.",
    "!Nara melons (Acanthosicyos horridus), found along the lower Kuiseb River, have been a seasonal food staple for the Topnaar people for centuries; the plant''s deep root system allows it to access groundwater far below the dune surface, illustrating a broader theme in this chapter — arid-adapted plants often solve water scarcity through root architecture rather than leaf reduction alone."
  ],
  "pull": "Hoodia''s traditional use raised early and influential questions about benefit-sharing."
}'::jsonb
where module_id = 'bot-210' and id = 'm1';

update public.materials set content = '{
  "heading": "Chapter 02 — arid flora, lecture overview",
  "lead": "Three survival strategies recur across this chapter''s species: water storage, deep rooting, and dormancy.",
  "body": [
    "Water storage: succulents like Hoodia store water in swollen stem tissue, trading growth speed for drought resilience.",
    "Deep rooting: !Nara and similar species reach groundwater inaccessible to shallow-rooted plants, decoupling their water supply from surface rainfall entirely.",
    "Dormancy: many arid annuals complete their life cycle in the brief window after rare rainfall, then persist as seed for years until conditions repeat.",
    "Traditional ecological knowledge often identifies these strategies functionally — which plants remain reliable in drought years — well before formal botanical classification catches up."
  ],
  "pull": "Traditional ecological knowledge often identifies survival strategies before formal classification catches up."
}'::jsonb
where module_id = 'bot-210' and id = 'm2';

update public.materials set content = '{
  "heading": "The structure of constitutional supremacy",
  "lead": "Article 1 declares Namibia a sovereign, secular, democratic and unitary state founded on the principle of constitutional supremacy — every other source of law in this course is read subject to that declaration.",
  "body": [
    "Article 66 recognises both customary and common law as part of Namibian law, but only to the extent that either does not conflict with the Constitution or an Act of Parliament — a hierarchy, not an equal partnership, between the three sources.",
    "The Constitution''s Chapter 3 bill of rights binds the State directly and, through Article 5, extends to natural and legal persons where the right in question is capable of being held against a private party — a question the courts resolve right by right rather than by a single general rule.",
    "Judicial review under Article 25 allows any competent court to test legislative or executive action against the Constitution, making the judiciary, rather than Parliament, the final interpreter of constitutional meaning — a structural choice with consequences that recur throughout this course."
  ],
  "pull": "Customary and common law are part of Namibian law only to the extent they do not conflict with the Constitution."
}'::jsonb
where module_id = 'law-110' and id = 'm1';

update public.materials set content = '{
  "heading": "Customary law within a mixed jurisdiction",
  "lead": "Namibia operates a mixed legal system: Roman-Dutch common law inherited through South African administration, statute, and customary law recognised under Article 66.",
  "body": [
    "The repugnancy test, developed in earlier colonial-era jurisprudence and retained in modified form, asks whether a customary rule conflicts with the Bill of Rights — if so, the customary rule yields, rather than the Constitution being read down to accommodate it.",
    "Traditional courts, established under the Traditional Authorities Act, exercise jurisdiction over customary matters but remain subject to appeal into the ordinary court structure, preserving the constitutional hierarchy rather than creating a fully parallel system.",
    "Codification of customary law — reducing unwritten practice to a fixed written text — remains contested: proponents argue it improves legal certainty, while critics note that customary law''s adaptability across communities and over time is itself a feature, not a defect, that codification risks erasing."
  ],
  "pull": "The customary rule yields to the Constitution — the Constitution is not read down to accommodate it."
}'::jsonb
where module_id = 'law-110' and id = 'm2';

update public.materials set content = '{
  "heading": "Tutorial 07 — applying the repugnancy test",
  "lead": "Work through the following scenario in your tutorial groups and be ready to present your reasoning.",
  "body": [
    "A traditional authority''s customary succession rule excludes daughters from inheriting communal land-use rights where a son is available. A daughter challenges the rule as inconsistent with Article 10''s equality guarantee.",
    "Apply the repugnancy test: does the customary rule conflict with the Bill of Rights? If so, what is the legal consequence for the rule, and does the traditional authority retain any residual discretion?",
    "Consider also Article 66''s own wording — it protects customary law only where it does not conflict with the Constitution ''or any other statutory law.'' Does this add anything beyond the repugnancy test itself?"
  ],
  "pull": "Does Article 66''s own wording add anything beyond the repugnancy test itself?"
}'::jsonb
where module_id = 'law-110' and id = 'm3';

alter table public.materials alter column content set not null;
