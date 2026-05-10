import type { ApplicationMark } from "@kagie/shared";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, Chip, Field, Notice, SectionTitle, ScreenScroll } from "../components/ui";
import { useKagieData } from "../data/KagieDataProvider";
import { colors } from "../theme";

function createEmptyInstitution() {
  return {
    province: "",
    institutionType: "",
    institutionName: "",
    faculty: "",
    choice1: "",
    choice2: "",
    choice3: ""
  };
}

export function ApplyScreen() {
  const {
    catalog,
    draft,
    syncing,
    offline,
    pendingDraftSync,
    ensureWorkingDraft,
    saveSection,
    saveMarks,
    selectPackage,
    addInstitution,
    removeInstitution
  } = useKagieData();

  const [learner, setLearner] = useState({
    idNumber: "",
    fullNames: "",
    surname: "",
    cellphone: "",
    email: "",
    province: "",
    postalCode: "",
    homeLanguage: "",
    gender: "",
    dob: "",
    address: ""
  });
  const [parent, setParent] = useState({
    relation: "",
    fullNames: "",
    surname: "",
    phone1: "",
    phone2: "",
    email: "",
    province: "",
    postalCode: "",
    address: ""
  });
  const [school, setSchool] = useState({
    schoolName: "",
    schoolProvince: "",
    schoolType: "",
    completionYear: "",
    average: ""
  });
  const [marks, setMarks] = useState<ApplicationMark[]>([]);
  const [markDraft, setMarkDraft] = useState({ subject: "", percent: "", level: "4" });
  const [institution, setInstitution] = useState(createEmptyInstitution());
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "warn" | "info"; text: string } | null>(null);

  useEffect(() => {
    if (!draft) return;
    setLearner({
      idNumber: draft.forms.learner.idNumber || "",
      fullNames: draft.forms.learner.fullNames || "",
      surname: draft.forms.learner.surname || "",
      cellphone: draft.forms.learner.cellphone || "",
      email: draft.forms.learner.email || "",
      province: draft.forms.learner.province || "",
      postalCode: draft.forms.learner.postalCode || "",
      homeLanguage: draft.forms.learner.homeLanguage || "",
      gender: draft.forms.learner.gender || "",
      dob: draft.forms.learner.dob || "",
      address: draft.forms.learner.address || ""
    });
    setParent({
      relation: draft.forms.parent.relation || "",
      fullNames: draft.forms.parent.fullNames || "",
      surname: draft.forms.parent.surname || "",
      phone1: draft.forms.parent.phone1 || "",
      phone2: draft.forms.parent.phone2 || "",
      email: draft.forms.parent.email || "",
      province: draft.forms.parent.province || "",
      postalCode: draft.forms.parent.postalCode || "",
      address: draft.forms.parent.address || ""
    });
    setSchool({
      schoolName: draft.forms.school.schoolName || "",
      schoolProvince: draft.forms.school.schoolProvince || "",
      schoolType: draft.forms.school.schoolType || "",
      completionYear: draft.forms.school.completionYear || "",
      average: String(draft.forms.school.average || "")
    });
    setMarks(draft.marks || []);
  }, [draft?.id, draft?.updatedAt]);

  const availableInstitutions = useMemo(() => {
    if (!catalog) return [];
    return catalog.institutions.filter((item) => {
      if (institution.province && item.province !== institution.province) return false;
      if (institution.institutionType && item.type !== institution.institutionType) return false;
      return true;
    });
  }, [catalog, institution.province, institution.institutionType]);

  const selectedInstitution = availableInstitutions.find((item) => item.name === institution.institutionName)
    || catalog?.institutions.find((item) => item.name === institution.institutionName)
    || null;
  const selectedInstitutionClosed = Boolean(selectedInstitution && (selectedInstitution.status === "closed" || selectedInstitution.isActive === false));
  const facultyOptions = selectedInstitution?.faculties || [];
  const courseOptions = facultyOptions.find((item) => item.name === institution.faculty)?.courses || [];

  function updateLearner(key: keyof typeof learner, value: string) {
    setLearner((current) => ({ ...current, [key]: value }));
  }
  function updateParent(key: keyof typeof parent, value: string) {
    setParent((current) => ({ ...current, [key]: value }));
  }
  function updateSchool(key: keyof typeof school, value: string) {
    setSchool((current) => ({ ...current, [key]: value }));
  }
  function updateInstitution(key: keyof typeof institution, value: string) {
    setInstitution((current) => ({ ...current, [key]: value }));
  }

  async function handleSaveLearner() {
    try {
      await saveSection("learner", learner);
      setNotice({ tone: "success", text: "Learner details saved to your Kagie draft." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not save learner details." });
    }
  }

  async function handleSaveParent() {
    try {
      await saveSection("parent", parent);
      setNotice({ tone: "success", text: "Guardian details saved." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not save guardian details." });
    }
  }

  async function handleSaveSchool() {
    try {
      await saveSection("school", {
        ...school,
        average: school.average ? Number(school.average) : null
      });
      setNotice({ tone: "success", text: "School details saved." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not save school details." });
    }
  }

  async function handleSaveMarks() {
    try {
      await saveMarks(marks);
      setNotice({ tone: "success", text: "Subject marks saved." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not save marks." });
    }
  }

  function addMarkLocally() {
    if (!markDraft.subject || !markDraft.percent) {
      setNotice({ tone: "warn", text: "Choose a subject and enter the percentage first." });
      return;
    }

    const next: ApplicationMark = {
      id: `${markDraft.subject}-${Date.now()}`,
      subject: markDraft.subject,
      percent: Number(markDraft.percent),
      level: Number(markDraft.level || 4)
    };
    setMarks((current) => [...current, next]);
    setMarkDraft({ subject: "", percent: "", level: "4" });
  }

  async function handleAddInstitution() {
    const required = [institution.province, institution.institutionType, institution.institutionName, institution.faculty, institution.choice1, institution.choice2, institution.choice3];
    if (required.some((value) => !String(value || "").trim())) {
      setNotice({ tone: "warn", text: "Complete province, institution, faculty, and all three course choices first." });
      return;
    }
    if (selectedInstitutionClosed) {
      setNotice({ tone: "warn", text: "Applications for this institution are currently closed." });
      return;
    }

    try {
      await addInstitution(institution);
      setInstitution({
        province: institution.province,
        institutionType: institution.institutionType,
        institutionName: "",
        faculty: "",
        choice1: "",
        choice2: "",
        choice3: ""
      });
      setNotice({ tone: "success", text: "Institution added to your shortlist." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not add the institution." });
    }
  }

  async function handleRemoveInstitution(institutionId: string) {
    try {
      await removeInstitution(institutionId);
      setNotice({ tone: "success", text: "Institution removed from your shortlist." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not remove the institution." });
    }
  }

  if (!catalog) {
    return (
      <ScreenScroll>
        <Card>
          <SectionTitle title="Preparing your mobile draft" hint="Kagie is loading the national catalog and your saved application state." />
        </Card>
      </ScreenScroll>
    );
  }

  if (!draft) {
    return (
      <ScreenScroll>
        <Card>
          <SectionTitle title="Start a new draft" hint="Your latest application is no longer in draft mode. Create a fresh mobile draft to keep applying." />
      <Button label={syncing ? "Opening draft..." : "Create new draft"} onPress={() => {
            ensureWorkingDraft().catch((error) => setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not open a new draft." }));
          }} disabled={syncing} />
          {notice ? <Notice tone={notice.tone} message={notice.text} /> : null}
        </Card>
      </ScreenScroll>
    );
  }

  return (
    <ScreenScroll>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Build your Kagie mobile application</Text>
        <Text style={styles.heroText}>Save your personal details, marks, package, and institution shortlist from one Android flow.</Text>
      </View>

      {notice ? <Notice tone={notice.tone} message={notice.text} /> : null}
      {offline || pendingDraftSync ? (
        <Notice
          tone="warn"
          message="Offline draft mode is active. You can keep saving form progress now, and Kagie will sync it when internet returns."
        />
      ) : null}

      <Card>
        <SectionTitle title="Learner details" hint="These are the student details Kagie uses across your applications." />
        <Field label="ID number" value={learner.idNumber} onChangeText={(value) => updateLearner("idNumber", value)} />
        <Field label="Full names" value={learner.fullNames} onChangeText={(value) => updateLearner("fullNames", value)} />
        <Field label="Surname" value={learner.surname} onChangeText={(value) => updateLearner("surname", value)} />
        <Field label="Cellphone" value={learner.cellphone} onChangeText={(value) => updateLearner("cellphone", value)} keyboardType="phone-pad" />
        <Field label="Email" value={learner.email} onChangeText={(value) => updateLearner("email", value)} keyboardType="email-address" />
        <Field label="Postal code" value={learner.postalCode} onChangeText={(value) => updateLearner("postalCode", value)} keyboardType="numeric" />
        <Field label="Date of birth" value={learner.dob} onChangeText={(value) => updateLearner("dob", value)} placeholder="YYYY-MM-DD" />
        <Field label="Address" value={learner.address} onChangeText={(value) => updateLearner("address", value)} multiline />
        <Text style={styles.smallLabel}>Province</Text>
        <View style={styles.wrapRow}>
          {catalog.provinces.map((item) => (
            <Chip key={item} label={item} active={learner.province === item} onPress={() => updateLearner("province", item)} />
          ))}
        </View>
        <Text style={styles.smallLabel}>Home language</Text>
        <View style={styles.wrapRow}>
          {catalog.homeLanguages.slice(0, 6).map((item) => (
            <Chip key={item} label={item} active={learner.homeLanguage === item} onPress={() => updateLearner("homeLanguage", item)} tone="gold" />
          ))}
        </View>
        <Button label={syncing ? "Saving..." : "Save learner details"} onPress={handleSaveLearner} disabled={syncing} />
      </Card>

      <Card>
        <SectionTitle title="Guardian details" hint="Kagie uses this section for follow-up, support, and institution contact alignment." />
        <Field label="Relation" value={parent.relation} onChangeText={(value) => updateParent("relation", value)} placeholder="Mother, father, guardian" />
        <Field label="Full names" value={parent.fullNames} onChangeText={(value) => updateParent("fullNames", value)} />
        <Field label="Surname" value={parent.surname} onChangeText={(value) => updateParent("surname", value)} />
        <Field label="Primary phone" value={parent.phone1} onChangeText={(value) => updateParent("phone1", value)} keyboardType="phone-pad" />
        <Field label="Alternative phone" value={parent.phone2} onChangeText={(value) => updateParent("phone2", value)} keyboardType="phone-pad" />
        <Field label="Email" value={parent.email} onChangeText={(value) => updateParent("email", value)} keyboardType="email-address" />
        <Field label="Postal code" value={parent.postalCode} onChangeText={(value) => updateParent("postalCode", value)} keyboardType="numeric" />
        <Field label="Address" value={parent.address} onChangeText={(value) => updateParent("address", value)} multiline />
        <Text style={styles.smallLabel}>Province</Text>
        <View style={styles.wrapRow}>
          {catalog.provinces.map((item) => (
            <Chip key={item} label={item} active={parent.province === item} onPress={() => updateParent("province", item)} />
          ))}
        </View>
        <Button label={syncing ? "Saving..." : "Save guardian details"} onPress={handleSaveParent} disabled={syncing} />
      </Card>

      <Card>
        <SectionTitle title="School details" hint="Capture your school background once and keep it attached to the draft." />
        <Field label="School name" value={school.schoolName} onChangeText={(value) => updateSchool("schoolName", value)} />
        <Field label="Completion year" value={school.completionYear} onChangeText={(value) => updateSchool("completionYear", value)} keyboardType="numeric" />
        <Field label="Average %" value={school.average} onChangeText={(value) => updateSchool("average", value)} keyboardType="numeric" />
        <Text style={styles.smallLabel}>School province</Text>
        <View style={styles.wrapRow}>
          {catalog.provinces.map((item) => (
            <Chip key={item} label={item} active={school.schoolProvince === item} onPress={() => updateSchool("schoolProvince", item)} />
          ))}
        </View>
        <Text style={styles.smallLabel}>School type</Text>
        <View style={styles.wrapRow}>
          {catalog.schoolTypes.map((item) => (
            <Chip key={item} label={item} active={school.schoolType === item} onPress={() => updateSchool("schoolType", item)} tone="orange" />
          ))}
        </View>
        <Button label={syncing ? "Saving..." : "Save school details"} onPress={handleSaveSchool} disabled={syncing} />
      </Card>

      <Card>
        <SectionTitle title="Marks" hint="Add DBE or IEB-style subjects with percentage and level." />
        <Field label="Subject" value={markDraft.subject} onChangeText={(value) => setMarkDraft((current) => ({ ...current, subject: value }))} />
        <View style={styles.wrapRow}>
          {catalog.subjects.slice(0, 10).map((subject) => (
            <Chip key={subject} label={subject} active={markDraft.subject === subject} onPress={() => setMarkDraft((current) => ({ ...current, subject }))} tone="gold" />
          ))}
        </View>
        <View style={styles.inlineFields}>
          <View style={styles.inlineField}>
            <Field label="Percent" value={markDraft.percent} onChangeText={(value) => setMarkDraft((current) => ({ ...current, percent: value }))} keyboardType="numeric" />
          </View>
          <View style={styles.inlineField}>
            <Field label="Level (1-7)" value={markDraft.level} onChangeText={(value) => setMarkDraft((current) => ({ ...current, level: value }))} keyboardType="numeric" />
          </View>
        </View>
        <Button label="Add subject" onPress={addMarkLocally} tone="secondary" />
        {marks.map((item) => (
          <View key={item.id} style={styles.markRow}>
            <View style={styles.markInfo}>
              <Text style={styles.markSubject}>{item.subject}</Text>
              <Text style={styles.markMeta}>{item.percent}% | Level {item.level}</Text>
            </View>
            <Pressable onPress={() => setMarks((current) => current.filter((entry) => entry.id !== item.id))}>
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
        ))}
        <Button label={syncing ? "Saving..." : "Save marks"} onPress={handleSaveMarks} disabled={syncing} />
      </Card>

      <Card>
        <SectionTitle title="Package" hint="Pick the Kagie package that matches how many institutions you want to target." />
        {catalog.packs.map((item) => (
          <Pressable
            key={item.id}
            disabled={syncing}
            onPress={() => {
              selectPackage(item.id)
                .then(() => setNotice({ tone: "success", text: `${item.name} selected.` }))
                .catch((error) => setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not save the package." }));
            }}
            style={[styles.packCard, draft.packageId === item.id && styles.packCardActive]}
          >
            <View style={styles.packTop}>
              <Text style={styles.packName}>{item.name}</Text>
              <Text style={styles.packPrice}>R{item.price}</Text>
            </View>
            <Text style={styles.packHighlight}>{item.highlight}</Text>
            <Text style={styles.packCopy}>{item.description}</Text>
            <Text style={styles.packLimit}>
              Limit: {item.institutionLimit === "unlimited" ? "Unlimited institutions" : `${item.institutionLimit} institutions`}
            </Text>
          </Pressable>
        ))}
      </Card>

      <Card>
        <SectionTitle title="Institutions and courses" hint="Build your shortlist with province, institution type, faculty, and three course choices." />
        <Text style={styles.smallLabel}>Province</Text>
        <View style={styles.wrapRow}>
          {catalog.provinces.map((item) => (
            <Chip key={item} label={item} active={institution.province === item} onPress={() => updateInstitution("province", item)} />
          ))}
        </View>
        <Text style={styles.smallLabel}>Institution type</Text>
        <View style={styles.wrapRow}>
          {catalog.institutionTypes.map((item) => (
            <Chip key={item} label={item} active={institution.institutionType === item} onPress={() => updateInstitution("institutionType", item)} tone="orange" />
          ))}
        </View>
        <Field label="Institution" value={institution.institutionName} onChangeText={(value) => updateInstitution("institutionName", value)} />
        <View style={styles.wrapRow}>
          {availableInstitutions.slice(0, 8).map((item) => (
            <Chip
              key={item.id}
              label={item.status === "closed" || item.isActive === false ? `${item.name} (Closed)` : item.name}
              active={institution.institutionName === item.name}
              onPress={() => updateInstitution("institutionName", item.name)}
              tone={item.status === "closed" || item.isActive === false ? "orange" : "sky"}
            />
          ))}
        </View>
        {selectedInstitutionClosed ? (
          <Notice tone="warn" message="Applications for this institution are currently closed." />
        ) : null}
        <Field label="Faculty" value={institution.faculty} onChangeText={(value) => updateInstitution("faculty", value)} />
        <View style={styles.wrapRow}>
          {facultyOptions.map((item) => (
            <Chip key={item.name} label={item.name} active={institution.faculty === item.name} onPress={() => updateInstitution("faculty", item.name)} tone="gold" />
          ))}
        </View>
        <Field label="Choice 1" value={institution.choice1} onChangeText={(value) => updateInstitution("choice1", value)} />
        <Field label="Choice 2" value={institution.choice2} onChangeText={(value) => updateInstitution("choice2", value)} />
        <Field label="Choice 3" value={institution.choice3} onChangeText={(value) => updateInstitution("choice3", value)} />
        <View style={styles.wrapRow}>
          {courseOptions.slice(0, 6).map((course) => (
            <Chip key={course} label={course} active={institution.choice1 === course || institution.choice2 === course || institution.choice3 === course} onPress={() => {
              if (!institution.choice1) return updateInstitution("choice1", course);
              if (!institution.choice2) return updateInstitution("choice2", course);
              if (!institution.choice3) return updateInstitution("choice3", course);
            }} tone="gold" />
          ))}
        </View>
        <Button label={syncing ? "Adding..." : "Add institution"} onPress={handleAddInstitution} disabled={syncing || selectedInstitutionClosed} />
      </Card>

      <Card>
        <SectionTitle title="Current shortlist" hint="These institutions are already attached to your mobile draft." />
        {(draft.institutions || []).length ? (
          draft.institutions.map((item) => (
            <View key={item.id} style={styles.shortlistItem}>
              <View style={styles.shortlistCopy}>
                <Text style={styles.shortlistTitle}>{item.institutionName}</Text>
                <Text style={styles.shortlistMeta}>{item.faculty}</Text>
                <Text style={styles.shortlistMeta}>{item.choice1} | {item.choice2} | {item.choice3}</Text>
              </View>
              <Pressable disabled={syncing} onPress={() => handleRemoveInstitution(item.id)}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          ))
        ) : (
          <Notice tone="info" message="No institutions added yet. Choose a package first, then build your shortlist here." />
        )}
      </Card>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: "#102a56",
    borderRadius: 28,
    padding: 22,
    gap: 8
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "900"
  },
  heroText: {
    color: "rgba(255,255,255,0.86)",
    lineHeight: 20
  },
  smallLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: colors.textMuted
  },
  wrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  inlineFields: {
    flexDirection: "row",
    gap: 10
  },
  inlineField: {
    flex: 1
  },
  markRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12
  },
  markInfo: {
    gap: 2,
    flex: 1
  },
  markSubject: {
    fontWeight: "800",
    color: colors.text
  },
  markMeta: {
    color: colors.textMuted
  },
  removeText: {
    color: colors.danger,
    fontWeight: "800"
  },
  packCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 16,
    gap: 6,
    backgroundColor: "#f9fbff"
  },
  packCardActive: {
    borderColor: colors.sky,
    backgroundColor: "#eaf5ff"
  },
  packTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center"
  },
  packName: {
    flex: 1,
    fontSize: 18,
    fontWeight: "900",
    color: colors.text
  },
  packPrice: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.brand
  },
  packHighlight: {
    color: colors.sky,
    fontWeight: "700"
  },
  packCopy: {
    color: colors.textMuted,
    lineHeight: 20
  },
  packLimit: {
    color: colors.text,
    fontWeight: "700"
  },
  shortlistItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  shortlistCopy: {
    flex: 1,
    gap: 3
  },
  shortlistTitle: {
    color: colors.text,
    fontWeight: "900"
  },
  shortlistMeta: {
    color: colors.textMuted,
    lineHeight: 18
  }
});
