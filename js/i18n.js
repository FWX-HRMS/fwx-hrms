// ============================================================
// Shared English/Arabic translation dictionary + helpers.
// Include this script on every page BEFORE any page-specific
// script that calls t() or applyTranslations().
// ============================================================
const translations = {
  en: {
    // Common
    logout: "Log out",
    logoutConfirmTitle: "Log out?",
    logoutConfirmMsg: "Are you sure you want to log out of your account?",
    settingsLink: "⚙ Settings",
    back: "← Back",
    cancel: "Cancel",
    close: "Close",
    view: "View",
    editBtn: "Edit",
    editEmployeeTitle: "Edit employee",
    editSupervisorInfoTitle: "Edit supervisor info",
    saving: "Saving…",
    somethingWrongUpdatingEmployee: "Something went wrong updating this employee.",
    employeeUpdatedToast: "Employee updated.",
    edit: "Edit",
    save: "Save",
    yes: "Yes",
    no: "No",
    langToggleToAr: "العربية",
    langToggleToEn: "English",

    // Brand
    brandStaffPortal: "Staff Portal",
    brandSupervisorPortal: "Supervisor Portal",
    brandHrPortal: "HR Portal",

    // Nav
    navTeamOverview: "Team overview",
    navUsers: "All Users",
    navClientCompanies: "Client Companies",
    navStaffLocations: "Staff Locations",
    navMyLeave: "My leave",
    navMyContract: "My Contract",
    navMyWarnings: "My Warnings",

    // Login (index.html)
    signInTitle: "Sign in",
    signInSub: "Use your employee file number and password.",
    fileNumberLabel: "File number",
    passwordLabel: "Password",
    signInBtn: "Sign in",
    signingIn: "Signing in…",
    forgotPasswordLink: "Forgot your password?",
    incorrectCreds: "Incorrect file number or password.",

    // Forgot password
    resetPasswordTitle: "Reset password",
    resetPasswordSub: "Enter your file number and we'll email you a reset link.",
    sendResetLinkBtn: "Send reset link",
    sending: "Sending…",
    resetLinkSentMsg: "If that file number has an account, a reset link has been sent to the email on file. Check your inbox (and spam folder).",
    backToSignIn: "Back to sign in",

    // Reset password
    setNewPasswordTitle: "Set a new password",
    setNewPasswordSub: "Choose a new password for your account.",
    newPasswordLabel: "New password",
    confirmNewPasswordLabel: "Confirm new password",
    updatePasswordBtn: "Update password",
    updating: "Updating…",
    passwordsDontMatch: "Passwords don't match.",
    resetLinkExpired: "This reset link may have expired. Request a new one from the sign-in page.",
    passwordUpdatedRedirect: "Password updated. Redirecting to sign in…",

    // Staff — My leave
    myLeaveTitle: "My leave",
    statAnnualEntitlement: "Annual entitlement",
    statTakenThisYear: "Taken this year",
    statRemaining: "Available",
    statPendingApproval: "Pending approval",
    statSickEntitlement: "Sick entitlement",
    statSickRemaining: "Sick remaining",
    applyForLeaveTitle: "Apply for leave",
    startDateLabel: "Start date",
    endDateLabel: "End date",
    typeLabel: "Type",
    typeAnnual: "Annual",
    typeSick: "Sick",
    typeUnpaid: "Unpaid",
    typeOther: "Other",
    reasonOptionalLabel: "Reason (optional)",
    attachDocOptionalLabel: "Attach supporting document (optional)",
    attachDocRequiredLabel: "Attach supporting document (required for sick leave)",
    submitRequestBtn: "Submit request",
    submitting: "Submitting…",
    myRequestsTitle: "My requests",
    colDates: "Dates",
    colDays: "Days",
    colType: "Type",
    colStatus: "Status",
    noRequestsYet: "No leave requests yet.",
    cancelBtn: "Cancel",
    endDateBeforeStart: "End date can't be before the start date.",
    somethingWrongSubmitting: "Something went wrong submitting your request.",
    couldNotUploadDoc: "Could not upload the attached document. Please try again.",
    documentRequiredForSick: "A supporting document is required for sick leave.",
    leaveRequestSubmittedToast: "Leave request submitted.",
    requestCancelledToast: "Request cancelled.",
    couldNotCancelToast: "Could not cancel that request.",

    // Supervisor — Team overview
    teamOverviewTitle: "Team overview",
    directReportsSuffix: "direct report",
    directReportsSuffixPlural: "direct reports",
    employeeCountSuffix: "employee",
    employeeCountSuffixPlural: "employees",
    pendingRequestsTitle: "Pending requests",
    usersListTitle: "Users",
    noUsersFound: "No users found.",
    colEmployeeName: "Employee Name",
    colReason: "Reason",
    colDocument: "Document",
    noPendingRequests: "No pending requests.",
    approveBtn: "Approve",
    rejectBtn: "Reject",
    teamBalancesTitle: "Team balances",
    downloadReportBtn: "Download Report",
    colIdNum: "ID #",
    colPeriod: "Period",
    monthsLabel: "months",
    colAnnual: "Annual",
    colPrevYearBalance: "Prev. Year Balance",
    colTaken: "Taken",
    colRemaining: "Available Balance",
    colPending: "Pending",
    colSick: "Sick",
    colSickTaken: "Sick Taken",
    colSickRemaining: "Sick Remaining",
    requestHistoryTitle: "Request history",
    noDecidedRequests: "No decided requests yet.",
    couldNotUpdateRequest: "Could not update that request.",
    couldNotOpenDoc: "Could not open that document.",
    statusApproved: "Approved",
    statusRejected: "Rejected",
    statusPending: "Pending",
    statusCancelled: "Cancelled",

    // Date range / report prompt
    selectReportPeriodTitle: "Select report period",
    optionalLeaveBlank: "Leave the dates blank to include the entire period.",
    employeeIdOptionalLabel: "Employee ID (optional — leave blank for all)",
    fromLabel: "From",
    toLabel: "To",
    generatePdfBtn: "Generate PDF",
    generateBtnLabel: "Generate",
    formatPdfLabel: "PDF",
    formatExcelLabel: "Excel",
    pleaseSelectFormat: "Please select at least one format.",
    prevBtn: "‹ Prev",
    nextBtn: "Next ›",
    showingRangeLabel: "Showing %start%–%end% of %total%",
    includeFrozenLabel: "Include frozen staff",
    noMatchingEmployeeToast: "No matching employee found for that ID.",
    noMatchingRequestsToast: "No matching leave requests found.",

    // Admin — Employees / Supervisors / Leave Requests
    employeesTitle: "Employees",
    employeesSub: "Add, manage, and report on everyone in the system.",
    tabEmployees: "Employees",
    tabSupervisors: "Supervisors",
    tabLeaveRequests: "Leave Requests",
    tabContracts: "Contracts",
    tabWarnings: "Warnings",
    giveWarningBtn: "Give Warning",
    warningsTitle: "Warnings",
    warningReasonCol: "Reason",
    noWarningsFound: "No warnings found.",
    createWarningTitle: "Give employee a warning",
    warningReasonLabel: "Reason for this warning",
    prepareWarningBtn: "Prepare Warning",
    warningDetailsTitle: "Warning",
    sendToEmployeeBtn: "Send to Employee",
    pleaseEnterWarningReason: "Please enter a reason for this warning.",
    somethingWrongCreatingWarning: "Something went wrong preparing this warning.",
    warningPreparedToast: "Warning prepared.",
    warningSavedToast: "Warning saved.",
    somethingWrongSendingWarning: "Something went wrong sending this warning.",
    warningSentToast: "Warning sent to employee.",
    warningStatusDraft: "Draft",
    warningStatusSent: "Given",
    confirmDeleteContract: "Delete this contract permanently? This cannot be undone.",
    confirmDeleteLeaveRequest: "Delete this leave request permanently? This cannot be undone.",
    somethingWrongDeletingLeaveRequest: "Something went wrong deleting this leave request.",
    leaveRequestDeletedToast: "Leave request deleted.",
    somethingWrongDeletingContract: "Something went wrong deleting this contract.",
    contractDeletedToast: "Contract deleted.",
    confirmDeleteWarning: "Delete this warning permanently? This cannot be undone.",
    somethingWrongDeletingWarning: "Something went wrong deleting this warning.",
    warningDeletedToast: "Warning deleted.",
    teamWarningsTitle: "Team Warnings",
    shareContractBtn: "Share Job Contract",
    contractsTitle: "Contracts",
    contractNameCol: "Contract Name",
    jobTitleLabel: "Job Title",
    colCreatedDate: "Created",
    noContractsFound: "No contracts found.",
    createContractTitle: "Prepare job contract",
    editContractFormTitle: "Edit job contract",
    addressLabel: "Address",
    contractStartDateLabel: "Contract start date",
    contractPeriodLabel: "Contract period (months)",
    prepareContractBtn: "Prepare Contract",
    preparing: "Preparing…",
    somethingWrongCreatingContract: "Something went wrong preparing this contract.",
    contractPreparedToast: "Contract prepared.",
    contractDetailsTitle: "Contract",
    signedOnLabel: "Signed on",
    employeeCommentsLabel: "Employee comments",
    shareAgainBtn: "Share Again",
    shareWithEmployeeBtn: "Share with Employee",
    saveChangesBtn: "Save Changes",
    somethingWrongSaving: "Something went wrong saving this contract.",
    contractSavedToast: "Contract saved.",
    somethingWrongSharing: "Something went wrong sharing this contract.",
    contractSharedToast: "Contract shared with employee.",
    contractStatusDraft: "Draft",
    contractStatusShared: "Awaiting Employee",
    contractStatusCommented: "Employee Commented",
    contractStatusSigned: "Signed",
    convertToArabicBtn: "Convert to Arabic",
    convertToEnglishBtn: "Convert to English",
    notifNewContract: "📄 You have a job contract awaiting your review. Visit My Contract to view it.",
    notifNewWarnings: "⚠️ You have %n% new warning(s) on file. Visit My Warnings to view them.",
    newWarningPopupTitle: "You have a new warning",
    myContractTitle: "My Contract",
    noContractYet: "No contract has been shared with you yet. Please check back later or contact HR.",
    sendCommentsTitle: "Send comments to admin",
    commentTextLabel: "If you have questions or requested changes, describe them here",
    sendCommentsBtn: "Send Comments",
    signContractTitle: "Sign this contract",
    signContractNote: "By providing your signature below and clicking Sign, you confirm that you have read, understood, and agree to the terms of this contract.",
    drawSignatureBtn: "Draw Signature",
    uploadSignatureBtn: "Upload Image",
    clearSignatureBtn: "Clear",
    pleaseProvideSignature: "Please draw or upload your signature before signing.",
    activeContractTitle: "You have an active job contract",
    activeContractUntil: "Your signed contract is valid until",
    activeContractGeneric: "You have a signed, active job contract on file.",
    newContractPopupTitle: "You have a new job contract",
    newContractPopupMsg: "Admin has shared a job contract with you. Please review it in My Contract.",
    waitingOnAdminMsg: "Your comment has been sent. Waiting for admin's response.",
    ok: "OK",
    docActivityTitle: "Notification",
    activeContractBlockTitle: "Active contract on file",
    activeContractBlockMsg: "%name% already has an active job contract (in progress or signed and not yet expired). Delete the existing contract first if you want to start a new one.",
    adminContractActivityMsg: "%n% contract(s) have recent employee activity (signed or commented) — %names%. Check the Contracts tab.",
    supervisorWarningNotifyMsg: "%n% new warning(s) issued to a member of your team (%names%). Check Team Warnings for details.",
    supervisorAckNotifyMsg: "%n% warning(s) newly acknowledged by your team (%names%).",
    typeFullNameLabel: "Type your full name to sign",
    signContractBtn: "Sign Contract",
    pleaseEnterComment: "Please enter a comment before submitting.",
    somethingWrongSubmittingComment: "Something went wrong submitting your comment.",
    commentsSentToast: "Your comment has been added and shared with the FWX admin.",
    pleaseTypeFullName: "Please type your full name.",
    signatureNameMismatch: "The name typed doesn't match your name on file.",
    somethingWrongSigning: "Something went wrong signing this contract.",
    contractSignedToast: "Contract signed.",
    myWarningsTitle: "My Warnings",
    noWarningsForYou: "You have no warnings on file.",
    colRole: "Role",
    colCompany: "Company",
    colDepartment: "Department",
    colSupervisor: "Supervisor",
    addNewEmployeeBtn: "+ Add new employee",
    addNewSupervisorBtn: "+ Add new supervisor",
    newEmployeeDetailsTitle: "New employee details",
    newSupervisorDetailsTitle: "New supervisor details",
    firstNameLabel: "First name",
    middleNameLabel: "Middle name",
    familyNameLabel: "Family name",
    emailLabel: "Email",
    hiringDateLabel: "Hiring date",
    annualEntitlementLabel: "Annual entitlement (days)",
    entitlementAutoNote: "Auto-calculated from hiring date — you can override it.",
    carryoverLabel: "Previous year remaining balance (days)",
    takenThisYearLabel: "Leave already taken this year (days)",
    takenThisYearNote: "Only needed if there's no previous year balance to draw from.",
    takenThisYearEditNote: "Optional — adds an extra approved-leave record for the entered amount.",
    companyClientLabel: "Company client",
    selectCompanyPlaceholder: "Select a company…",
    departmentLabel: "Department",
    departmentTechnical: "Technical",
    departmentSales: "Sales",
    departmentMarketing: "Marketing",
    departmentHR: "HR",
    departmentFinance: "Finance",
    departmentIT: "IT",
    departmentAdministration: "Administration",
    roleLabel: "Role",
    roleStaff: "Staff",
    roleSupervisor: "Supervisor",
    assignSupervisorLabel: "Assign to supervisor",
    selectSupervisorPlaceholder: "Select a supervisor…",
    selectCompanyFirstPlaceholder: "Select a company first…",
    noSupervisorsYetPlaceholder: "No supervisors yet in this company",
    createBtn: "Create",
    creating: "Creating…",
    entitlementHelpText: "Leave entitlement is calculated automatically from hiring date: 14 annual + 14 sick days for 5 years of service or less, 21 annual + 14 sick days for more than 5 years.",
    pleaseSelectCompany: "Please select a company client.",
    pleaseAssignSupervisor: "Please assign this staff member to a supervisor.",
    somethingWrongCreating: "Something went wrong creating this employee.",
    employeeCreatedMsg: "Employee created. Share these with them — they can change the password after logging in.",
    fileNumColonLabel: "File number:",
    initialPasswordColonLabel: "Initial password:",
    copyDetailsBtn: "Copy details",
    copiedToast: "Copied.",
    resetPasswordBtn: "Reset password",
    actionsBtn: "Actions",
    freezeBtn: "Freeze",
    unfreezeBtn: "Unfreeze",
    freezeUserTitle: "Freeze user account",
    freezeReasonLabel: "Reason",
    selectReasonPlaceholder: "Select a reason…",
    reasonResignation: "Resignation",
    reasonEndOfContract: "End of contract",
    reasonTermination: "Termination",
    freezeConfirmBtn: "Freeze account",
    pleaseSelectReason: "Please select a reason.",
    unfreezeConfirmTitle: "Unfreeze user account?",
    unfreezeConfirmMsg: "%name% will regain access to the system.",
    couldNotFreezeToast: "Could not freeze that account.",
    couldNotUnfreezeToast: "Could not unfreeze that account.",
    accountFrozenToast: "Account frozen.",
    accountUnfrozenToast: "Account unfrozen.",
    statusFrozenBadge: "Frozen",
    frozenSinceLabel: "Frozen since",
    frozenReasonColLabel: "Freeze reason",
    accountSuspendedLoginMsg: "This account has been suspended. Please contact your administrator.",
    deleteBtn: "Delete",
    resetPasswordConfirmTitle: "Reset password?",
    couldNotResetPassword: "Could not reset that password.",
    newPasswordGeneratedTitle: "New password generated",
    shareSecurelyNote: "Share this with them securely.",
    deleteEmployeeConfirmTitle: "Delete employee?",
    couldNotDeleteEmployee: "Could not delete that employee.",
    employeeDeletedToast: "Employee deleted.",
    employeeDetailsTitle: "Employee details",
    leaveHistoryTitle: "Leave history",
    noLeaveHistoryOnFile: "No leave requests on file.",
    leaveRequestsTitle: "Leave Requests",
    noLeaveRequestsFound: "No leave requests found.",
    downloadReportPdfBtn: "Download Leave Report",
    noSearchResultsToast: "No results match your search.",
    noResultsTitle: "No matches found",

    // Client Companies
    clientCompaniesTitle: "Client Companies",
    clientCompaniesSub: "Pick a company to manage its staff and supervisors.",
    addNewClientCompanyBtn: "+ Add new client company",
    newClientCompanyTitle: "New client company",
    companyNameLabel: "Company name",
    companyNamePlaceholder: "e.g. Vodafone",
    addBtn: "Add",
    adding: "Adding…",
    enterCompanyName: "Enter a company name.",
    companyAlreadyExists: "That company already exists.",
    somethingWrongAddingCompany: "Something went wrong adding it.",
    companyAddedToast: "Company added.",
    peopleSuffix: "people",

    // Settings
    settingsTitle: "Settings",
    settingsSub: "Update your name, email, or password.",
    yourNameTitle: "Your name",
    fullNameLabel: "Full name",
    saveNameBtn: "Save name",
    somethingWrongUpdatingName: "Something went wrong updating your name.",
    nameUpdatedMsg: "Name updated.",
    yourEmailTitle: "Your email",
    currentLabel: "Current:",
    newEmailLabel: "New email address",
    updateEmailBtn: "Update email",
    emailChangeConfirmMsg: "A confirmation link was sent to your new email. Please check your inbox and confirm it — your login will use the new address once confirmed.",
    changePasswordTitle: "Change password",
    somethingWrongUpdatingPassword: "Something went wrong updating your password.",
    passwordUpdatedToast: "Password updated.",

    // Staff Locations
    staffLocationsTitle: "Staff Locations",
    staffLocationsSubSupervisor: "Live locations of your direct reports.",
    staffLocationsSubAdmin: "Live locations of everyone in the system.",
    staffLocationsListTitle: "Last known locations",
    colLastUpdated: "Last updated",
    noLocationsShared: "No location data shared yet.",
    couldNotLoadLocations: "Could not load staff locations.",
    justNow: "Just now",
    minutesAgo: "%n% min ago",
    hoursAgo: "%n% hr ago",
    daysAgo: "%n% days ago",
    locationSharingTitle: "Location sharing",
    locationSharingNote: "Your location is shared with your management team.",
    locationRequesting: "Requesting…",
    locationActive: "Active",
    locationDenied: "Blocked — enable location access in your browser",
    locationUnsupported: "Not supported on this device",
    mapStreetLabel: "Street",
    mapSatelliteLabel: "Satellite",
    accuracyLabel: "Accurate to ~%n% m",

    // Extra keys for admin.js dynamic content
    okBtn: "OK",
    confirmBtn: "Confirm",
    loadingText: "Loading…",
    couldNotLoadLeaveRequests: "Could not load leave requests.",
    colFileNumber: "File number",
    colEmail: "Email",
    colHiringDate: "Hiring date",
    colDob: "Date of birth",
    colNationality: "Nationality",
    colEducation: "Education",
    colSalary: "Salary",
    colAnnualLeaveDays: "Annual leave days",
    colTakenThisYear: "Taken this year",
    colSickLeaveDays: "Sick leave days",
    colSickTakenThisYear: "Sick taken this year",
    resetPasswordConfirmMsg: "Generate a new password for %name%? Their current password will stop working.",
    couldNotResetPasswordToast: "Could not reset that password.",
    newPasswordGeneratedMsg: "%name% (#%fileNumber%) — new password: <strong>%password%</strong><br><br>Share this with them securely.",
    deleteEmployeeConfirmMsg: "Delete %name% (#%fileNumber%)? This permanently removes their login and records. This can't be undone.",
    companyScopedTitleSuffix: "Employees",
    companyScopedSub: "Add, manage, and report on %company% staff and supervisors only.",
  },

  ar: {
    // Common
    logout: "تسجيل الخروج",
    logoutConfirmTitle: "تسجيل الخروج؟",
    logoutConfirmMsg: "هل أنت متأكد من رغبتك في تسجيل الخروج من حسابك؟",
    settingsLink: "⚙ الإعدادات",
    back: "→ رجوع",
    cancel: "إلغاء",
    close: "إغلاق",
    view: "عرض",
    editBtn: "تعديل",
    editEmployeeTitle: "تعديل الموظف",
    editSupervisorInfoTitle: "تعديل بيانات المشرف",
    saving: "جارٍ الحفظ…",
    somethingWrongUpdatingEmployee: "حدث خطأ أثناء تحديث هذا الموظف.",
    employeeUpdatedToast: "تم تحديث الموظف.",
    edit: "تعديل",
    save: "حفظ",
    yes: "نعم",
    no: "لا",
    langToggleToAr: "العربية",
    langToggleToEn: "English",

    // Brand
    brandStaffPortal: "بوابة الموظف",
    brandSupervisorPortal: "بوابة المشرف",
    brandHrPortal: "بوابة الموارد البشرية",

    // Nav
    navTeamOverview: "نظرة عامة على الفريق",
    navUsers: "جميع المستخدمين",
    navClientCompanies: "الشركات العميلة",
    navStaffLocations: "مواقع الموظفين",
    navMyLeave: "إجازتي",
    navMyContract: "عقدي",
    navMyWarnings: "إنذاراتي",

    // Login (index.html)
    signInTitle: "تسجيل الدخول",
    signInSub: "استخدم رقم ملفك الوظيفي وكلمة المرور.",
    fileNumberLabel: "رقم الملف",
    passwordLabel: "كلمة المرور",
    signInBtn: "تسجيل الدخول",
    signingIn: "جارٍ تسجيل الدخول…",
    forgotPasswordLink: "نسيت كلمة المرور؟",
    incorrectCreds: "رقم الملف أو كلمة المرور غير صحيحة.",

    // Forgot password
    resetPasswordTitle: "إعادة تعيين كلمة المرور",
    resetPasswordSub: "أدخل رقم ملفك الوظيفي وسنرسل لك رابط إعادة التعيين عبر البريد الإلكتروني.",
    sendResetLinkBtn: "إرسال رابط إعادة التعيين",
    sending: "جارٍ الإرسال…",
    resetLinkSentMsg: "إذا كان لهذا الرقم الوظيفي حساب، فقد تم إرسال رابط إعادة التعيين إلى البريد الإلكتروني المسجل. تحقق من بريدك الوارد (ومجلد الرسائل غير المرغوب فيها).",
    backToSignIn: "العودة إلى تسجيل الدخول",

    // Reset password
    setNewPasswordTitle: "تعيين كلمة مرور جديدة",
    setNewPasswordSub: "اختر كلمة مرور جديدة لحسابك.",
    newPasswordLabel: "كلمة المرور الجديدة",
    confirmNewPasswordLabel: "تأكيد كلمة المرور الجديدة",
    updatePasswordBtn: "تحديث كلمة المرور",
    updating: "جارٍ التحديث…",
    passwordsDontMatch: "كلمتا المرور غير متطابقتين.",
    resetLinkExpired: "قد يكون رابط إعادة التعيين هذا منتهي الصلاحية. اطلب رابطًا جديدًا من صفحة تسجيل الدخول.",
    passwordUpdatedRedirect: "تم تحديث كلمة المرور. جارٍ التحويل إلى تسجيل الدخول…",

    // Staff — My leave
    myLeaveTitle: "إجازتي",
    statAnnualEntitlement: "رصيد الإجازة السنوية",
    statTakenThisYear: "المستخدم هذا العام",
    statRemaining: "المتاح",
    statPendingApproval: "بانتظار الموافقة",
    statSickEntitlement: "رصيد الإجازة المرضية",
    statSickRemaining: "المرضي المتبقي",
    applyForLeaveTitle: "تقديم طلب إجازة",
    startDateLabel: "تاريخ البدء",
    endDateLabel: "تاريخ الانتهاء",
    typeLabel: "النوع",
    typeAnnual: "سنوية",
    typeSick: "مرضية",
    typeUnpaid: "بدون راتب",
    typeOther: "أخرى",
    reasonOptionalLabel: "السبب (اختياري)",
    attachDocOptionalLabel: "إرفاق مستند داعم (اختياري)",
    attachDocRequiredLabel: "إرفاق مستند داعم (مطلوب للإجازة المرضية)",
    submitRequestBtn: "إرسال الطلب",
    submitting: "جارٍ الإرسال…",
    myRequestsTitle: "طلباتي",
    colDates: "التواريخ",
    colDays: "الأيام",
    colType: "النوع",
    colStatus: "الحالة",
    noRequestsYet: "لا توجد طلبات إجازة بعد.",
    cancelBtn: "إلغاء",
    endDateBeforeStart: "لا يمكن أن يكون تاريخ الانتهاء قبل تاريخ البدء.",
    somethingWrongSubmitting: "حدث خطأ أثناء إرسال طلبك.",
    couldNotUploadDoc: "تعذر رفع المستند المرفق. حاول مرة أخرى.",
    documentRequiredForSick: "يلزم إرفاق مستند داعم للإجازة المرضية.",
    leaveRequestSubmittedToast: "تم إرسال طلب الإجازة.",
    requestCancelledToast: "تم إلغاء الطلب.",
    couldNotCancelToast: "تعذر إلغاء هذا الطلب.",

    // Supervisor — Team overview
    teamOverviewTitle: "نظرة عامة على الفريق",
    directReportsSuffix: "تابع مباشر",
    directReportsSuffixPlural: "تابعين مباشرين",
    employeeCountSuffix: "موظف",
    employeeCountSuffixPlural: "موظفين",
    pendingRequestsTitle: "الطلبات المعلقة",
    usersListTitle: "المستخدمون",
    noUsersFound: "لم يتم العثور على مستخدمين.",
    colEmployeeName: "اسم الموظف",
    colReason: "السبب",
    colDocument: "المستند",
    noPendingRequests: "لا توجد طلبات معلقة.",
    approveBtn: "موافقة",
    rejectBtn: "رفض",
    teamBalancesTitle: "أرصدة الفريق",
    downloadReportBtn: "تنزيل التقرير",
    colIdNum: "الرقم الوظيفي",
    colPeriod: "المدة",
    monthsLabel: "أشهر",
    colAnnual: "سنوية",
    colPrevYearBalance: "رصيد العام السابق",
    colTaken: "مستخدم",
    colRemaining: "الرصيد المتاح",
    colPending: "معلق",
    colSick: "مرضية",
    colSickTaken: "مرضية مستخدمة",
    colSickRemaining: "مرضية متبقية",
    requestHistoryTitle: "سجل الطلبات",
    noDecidedRequests: "لا توجد طلبات تم البت فيها بعد.",
    couldNotUpdateRequest: "تعذر تحديث هذا الطلب.",
    couldNotOpenDoc: "تعذر فتح هذا المستند.",
    statusApproved: "موافق عليه",
    statusRejected: "مرفوض",
    statusPending: "معلق",
    statusCancelled: "ملغى",

    // Date range / report prompt
    selectReportPeriodTitle: "اختر فترة التقرير",
    optionalLeaveBlank: "اترك التواريخ فارغة لتشمل الفترة بأكملها.",
    employeeIdOptionalLabel: "الرقم الوظيفي (اختياري — اتركه فارغًا للجميع)",
    fromLabel: "من",
    toLabel: "إلى",
    generatePdfBtn: "إنشاء PDF",
    generateBtnLabel: "إنشاء",
    formatPdfLabel: "PDF",
    formatExcelLabel: "Excel",
    pleaseSelectFormat: "الرجاء اختيار صيغة واحدة على الأقل.",
    prevBtn: "‹ السابق",
    nextBtn: "التالي ›",
    showingRangeLabel: "عرض %start%–%end% من %total%",
    includeFrozenLabel: "تضمين الموظفين المجمّدين",
    noMatchingEmployeeToast: "لم يتم العثور على موظف مطابق لهذا الرقم.",
    noMatchingRequestsToast: "لم يتم العثور على طلبات إجازة مطابقة.",

    // Admin — Employees / Supervisors / Leave Requests
    employeesTitle: "الموظفون",
    employeesSub: "أضف الجميع في النظام وأدرهم وأصدر تقاريرهم.",
    tabEmployees: "الموظفون",
    tabSupervisors: "المشرفون",
    tabLeaveRequests: "طلبات الإجازة",
    tabContracts: "العقود",
    tabWarnings: "الإنذارات",
    giveWarningBtn: "إعطاء إنذار",
    warningsTitle: "الإنذارات",
    warningReasonCol: "السبب",
    noWarningsFound: "لم يتم العثور على إنذارات.",
    createWarningTitle: "إعطاء الموظف إنذارًا",
    warningReasonLabel: "سبب هذا الإنذار",
    prepareWarningBtn: "إعداد الإنذار",
    warningDetailsTitle: "الإنذار",
    sendToEmployeeBtn: "إرسال إلى الموظف",
    pleaseEnterWarningReason: "الرجاء إدخال سبب لهذا الإنذار.",
    somethingWrongCreatingWarning: "حدث خطأ أثناء إعداد هذا الإنذار.",
    warningPreparedToast: "تم إعداد الإنذار.",
    warningSavedToast: "تم حفظ الإنذار.",
    somethingWrongSendingWarning: "حدث خطأ أثناء إرسال هذا الإنذار.",
    warningSentToast: "تم إرسال الإنذار إلى الموظف.",
    warningStatusDraft: "مسودة",
    warningStatusSent: "تم الإعطاء",
    confirmDeleteContract: "هل تريد حذف هذا العقد نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.",
    confirmDeleteLeaveRequest: "هل تريد حذف طلب الإجازة هذا نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.",
    somethingWrongDeletingLeaveRequest: "حدث خطأ أثناء حذف طلب الإجازة هذا.",
    leaveRequestDeletedToast: "تم حذف طلب الإجازة.",
    somethingWrongDeletingContract: "حدث خطأ أثناء حذف هذا العقد.",
    contractDeletedToast: "تم حذف العقد.",
    confirmDeleteWarning: "هل تريد حذف هذا الإنذار نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.",
    somethingWrongDeletingWarning: "حدث خطأ أثناء حذف هذا الإنذار.",
    warningDeletedToast: "تم حذف الإنذار.",
    teamWarningsTitle: "إنذارات الفريق",
    shareContractBtn: "مشاركة عقد العمل",
    contractsTitle: "العقود",
    contractNameCol: "اسم العقد",
    jobTitleLabel: "المسمى الوظيفي",
    colCreatedDate: "تاريخ الإنشاء",
    noContractsFound: "لم يتم العثور على عقود.",
    createContractTitle: "إعداد عقد العمل",
    editContractFormTitle: "تعديل عقد العمل",
    addressLabel: "العنوان",
    contractStartDateLabel: "تاريخ بدء العقد",
    contractPeriodLabel: "مدة العقد (أشهر)",
    prepareContractBtn: "إعداد العقد",
    preparing: "جارٍ الإعداد…",
    somethingWrongCreatingContract: "حدث خطأ أثناء إعداد هذا العقد.",
    contractPreparedToast: "تم إعداد العقد.",
    contractDetailsTitle: "العقد",
    signedOnLabel: "تم التوقيع في",
    employeeCommentsLabel: "ملاحظات الموظف",
    shareAgainBtn: "إعادة المشاركة",
    shareWithEmployeeBtn: "مشاركة مع الموظف",
    saveChangesBtn: "حفظ التغييرات",
    somethingWrongSaving: "حدث خطأ أثناء حفظ هذا العقد.",
    contractSavedToast: "تم حفظ العقد.",
    somethingWrongSharing: "حدث خطأ أثناء مشاركة هذا العقد.",
    contractSharedToast: "تمت مشاركة العقد مع الموظف.",
    contractStatusDraft: "مسودة",
    contractStatusShared: "بانتظار الموظف",
    contractStatusCommented: "علّق الموظف",
    contractStatusSigned: "موقّع",
    convertToArabicBtn: "تحويل إلى العربية",
    convertToEnglishBtn: "تحويل إلى الإنجليزية",
    notifNewContract: "📄 لديك عقد عمل بانتظار مراجعتك. زُر صفحة عقدي للاطلاع عليه.",
    notifNewWarnings: "⚠️ لديك %n% إنذار جديد مسجل. زُر صفحة إنذاراتي للاطلاع عليها.",
    newWarningPopupTitle: "لديك إنذار جديد",
    myContractTitle: "عقدي",
    noContractYet: "لم تتم مشاركة أي عقد معك بعد. يرجى التحقق لاحقًا أو التواصل مع الموارد البشرية.",
    sendCommentsTitle: "إرسال ملاحظات إلى الإدارة",
    commentTextLabel: "إذا كان لديك أسئلة أو تعديلات مطلوبة، اذكرها هنا",
    sendCommentsBtn: "إرسال الملاحظات",
    signContractTitle: "توقيع هذا العقد",
    signContractNote: "بتقديم توقيعك أدناه والنقر على توقيع، فإنك تؤكد أنك قرأت وفهمت ووافقت على شروط هذا العقد.",
    drawSignatureBtn: "رسم التوقيع",
    uploadSignatureBtn: "رفع صورة",
    clearSignatureBtn: "مسح",
    pleaseProvideSignature: "الرجاء رسم توقيعك أو رفع صورة له قبل التوقيع.",
    activeContractTitle: "لديك عقد عمل ساري",
    activeContractUntil: "عقدك الموقّع ساري المفعول حتى",
    activeContractGeneric: "لديك عقد عمل موقّع وساري المفعول مسجل لدينا.",
    newContractPopupTitle: "لديك عقد عمل جديد",
    newContractPopupMsg: "قامت الإدارة بمشاركة عقد عمل معك. يرجى مراجعته في صفحة عقدي.",
    waitingOnAdminMsg: "تم إرسال ملاحظتك. بانتظار رد الإدارة.",
    ok: "موافق",
    docActivityTitle: "إشعار",
    activeContractBlockTitle: "يوجد عقد ساري مسجل",
    activeContractBlockMsg: "لدى %name% بالفعل عقد عمل ساري (قيد المعالجة أو موقّع ولم تنتهِ مدته بعد). يرجى حذف العقد الحالي أولاً إذا كنت تريد إعداد عقد جديد.",
    adminContractActivityMsg: "يوجد نشاط حديث من الموظف على %n% عقد (توقيع أو تعليق) — %names%. تحقق من تبويب العقود.",
    supervisorWarningNotifyMsg: "تم إصدار %n% إنذار جديد لأحد أعضاء فريقك (%names%). تحقق من إنذارات الفريق للتفاصيل.",
    supervisorAckNotifyMsg: "تم إقرار %n% إنذار من قبل أعضاء فريقك (%names%).",
    typeFullNameLabel: "اكتب اسمك الكامل للتوقيع",
    signContractBtn: "توقيع العقد",
    pleaseEnterComment: "الرجاء كتابة ملاحظة قبل الإرسال.",
    somethingWrongSubmittingComment: "حدث خطأ أثناء إرسال ملاحظتك.",
    commentsSentToast: "تمت إضافة ملاحظتك ومشاركتها مع إدارة FWX.",
    pleaseTypeFullName: "الرجاء كتابة اسمك الكامل.",
    signatureNameMismatch: "الاسم المكتوب لا يطابق اسمك المسجل.",
    somethingWrongSigning: "حدث خطأ أثناء توقيع هذا العقد.",
    contractSignedToast: "تم توقيع العقد.",
    myWarningsTitle: "إنذاراتي",
    noWarningsForYou: "لا توجد إنذارات مسجلة عليك.",
    colRole: "الدور",
    colCompany: "الشركة",
    colDepartment: "القسم",
    colSupervisor: "المشرف",
    addNewEmployeeBtn: "+ إضافة موظف جديد",
    addNewSupervisorBtn: "+ إضافة مشرف جديد",
    newEmployeeDetailsTitle: "بيانات الموظف الجديد",
    newSupervisorDetailsTitle: "بيانات المشرف الجديد",
    firstNameLabel: "الاسم الأول",
    middleNameLabel: "الاسم الأوسط",
    familyNameLabel: "اسم العائلة",
    emailLabel: "البريد الإلكتروني",
    hiringDateLabel: "تاريخ التعيين",
    annualEntitlementLabel: "رصيد الإجازة السنوية (أيام)",
    entitlementAutoNote: "يُحسب تلقائيًا من تاريخ التعيين — يمكنك تعديله.",
    carryoverLabel: "الرصيد المتبقي من العام السابق (أيام)",
    takenThisYearLabel: "الإجازة المستخدمة هذا العام (أيام)",
    takenThisYearNote: "مطلوب فقط في حال عدم وجود رصيد من العام السابق.",
    takenThisYearEditNote: "اختياري — يضيف سجل إجازة معتمدة إضافي بالعدد المُدخل.",
    companyClientLabel: "الشركة العميلة",
    selectCompanyPlaceholder: "اختر شركة…",
    departmentLabel: "القسم",
    departmentTechnical: "تقني",
    departmentSales: "مبيعات",
    departmentMarketing: "تسويق",
    departmentHR: "موارد بشرية",
    departmentFinance: "مالية",
    departmentIT: "تقنية المعلومات",
    departmentAdministration: "إدارة",
    roleLabel: "الدور",
    roleStaff: "موظف",
    roleSupervisor: "مشرف",
    assignSupervisorLabel: "تعيين مشرف",
    selectSupervisorPlaceholder: "اختر مشرفًا…",
    selectCompanyFirstPlaceholder: "اختر شركة أولاً…",
    noSupervisorsYetPlaceholder: "لا يوجد مشرفون بعد في هذه الشركة",
    createBtn: "إنشاء",
    creating: "جارٍ الإنشاء…",
    entitlementHelpText: "يُحسب رصيد الإجازة تلقائيًا من تاريخ التعيين: 14 يومًا سنويًا + 14 يومًا مرضيًا لمن لديهم 5 سنوات خدمة أو أقل، و21 يومًا سنويًا + 14 يومًا مرضيًا لمن لديهم أكثر من 5 سنوات.",
    pleaseSelectCompany: "الرجاء اختيار شركة عميلة.",
    pleaseAssignSupervisor: "الرجاء تعيين مشرف لهذا الموظف.",
    somethingWrongCreating: "حدث خطأ أثناء إنشاء هذا الموظف.",
    employeeCreatedMsg: "تم إنشاء الموظف. شارك هذه البيانات معه — يمكنه تغيير كلمة المرور بعد تسجيل الدخول.",
    fileNumColonLabel: "الرقم الوظيفي:",
    initialPasswordColonLabel: "كلمة المرور الأولية:",
    copyDetailsBtn: "نسخ البيانات",
    copiedToast: "تم النسخ.",
    resetPasswordBtn: "إعادة تعيين كلمة المرور",
    actionsBtn: "الإجراءات",
    freezeBtn: "تجميد",
    unfreezeBtn: "إلغاء التجميد",
    freezeUserTitle: "تجميد حساب المستخدم",
    freezeReasonLabel: "السبب",
    selectReasonPlaceholder: "اختر سببًا…",
    reasonResignation: "استقالة",
    reasonEndOfContract: "انتهاء العقد",
    reasonTermination: "إنهاء الخدمة",
    freezeConfirmBtn: "تجميد الحساب",
    pleaseSelectReason: "الرجاء اختيار سبب.",
    unfreezeConfirmTitle: "إلغاء تجميد حساب المستخدم؟",
    unfreezeConfirmMsg: "سيستعيد %name% إمكانية الوصول إلى النظام.",
    couldNotFreezeToast: "تعذر تجميد هذا الحساب.",
    couldNotUnfreezeToast: "تعذر إلغاء تجميد هذا الحساب.",
    accountFrozenToast: "تم تجميد الحساب.",
    accountUnfrozenToast: "تم إلغاء تجميد الحساب.",
    statusFrozenBadge: "مجمّد",
    frozenSinceLabel: "مجمّد منذ",
    frozenReasonColLabel: "سبب التجميد",
    accountSuspendedLoginMsg: "تم تعليق هذا الحساب. يرجى التواصل مع المسؤول.",
    deleteBtn: "حذف",
    resetPasswordConfirmTitle: "إعادة تعيين كلمة المرور؟",
    couldNotResetPassword: "تعذر إعادة تعيين كلمة المرور.",
    newPasswordGeneratedTitle: "تم إنشاء كلمة مرور جديدة",
    shareSecurelyNote: "شارك هذه البيانات معه بطريقة آمنة.",
    deleteEmployeeConfirmTitle: "حذف الموظف؟",
    couldNotDeleteEmployee: "تعذر حذف هذا الموظف.",
    employeeDeletedToast: "تم حذف الموظف.",
    employeeDetailsTitle: "بيانات الموظف",
    leaveHistoryTitle: "سجل الإجازات",
    noLeaveHistoryOnFile: "لا توجد طلبات إجازة مسجلة.",
    leaveRequestsTitle: "طلبات الإجازة",
    noLeaveRequestsFound: "لم يتم العثور على طلبات إجازة.",
    downloadReportPdfBtn: "تنزيل تقرير الإجازات",
    noSearchResultsToast: "لا توجد نتائج مطابقة لبحثك.",
    noResultsTitle: "لا توجد نتائج",

    // Client Companies
    clientCompaniesTitle: "الشركات العميلة",
    clientCompaniesSub: "اختر شركة لإدارة موظفيها ومشرفيها.",
    addNewClientCompanyBtn: "+ إضافة شركة عميلة جديدة",
    newClientCompanyTitle: "شركة عميلة جديدة",
    companyNameLabel: "اسم الشركة",
    companyNamePlaceholder: "مثال: Vodafone",
    addBtn: "إضافة",
    adding: "جارٍ الإضافة…",
    enterCompanyName: "أدخل اسم الشركة.",
    companyAlreadyExists: "هذه الشركة موجودة بالفعل.",
    somethingWrongAddingCompany: "حدث خطأ أثناء إضافتها.",
    companyAddedToast: "تمت إضافة الشركة.",
    peopleSuffix: "أشخاص",

    // Settings
    settingsTitle: "الإعدادات",
    settingsSub: "حدّث اسمك أو بريدك الإلكتروني أو كلمة المرور.",
    yourNameTitle: "اسمك",
    fullNameLabel: "الاسم الكامل",
    saveNameBtn: "حفظ الاسم",
    somethingWrongUpdatingName: "حدث خطأ أثناء تحديث اسمك.",
    nameUpdatedMsg: "تم تحديث الاسم.",
    yourEmailTitle: "بريدك الإلكتروني",
    currentLabel: "الحالي:",
    newEmailLabel: "البريد الإلكتروني الجديد",
    updateEmailBtn: "تحديث البريد الإلكتروني",
    emailChangeConfirmMsg: "تم إرسال رابط تأكيد إلى بريدك الإلكتروني الجديد. يرجى التحقق من بريدك الوارد وتأكيده — سيُستخدم العنوان الجديد لتسجيل الدخول بعد التأكيد.",
    changePasswordTitle: "تغيير كلمة المرور",
    somethingWrongUpdatingPassword: "حدث خطأ أثناء تحديث كلمة المرور.",
    passwordUpdatedToast: "تم تحديث كلمة المرور.",

    // Staff Locations
    staffLocationsTitle: "مواقع الموظفين",
    staffLocationsSubSupervisor: "المواقع الحية لتابعيك المباشرين.",
    staffLocationsSubAdmin: "المواقع الحية لجميع أفراد النظام.",
    staffLocationsListTitle: "آخر المواقع المعروفة",
    colLastUpdated: "آخر تحديث",
    noLocationsShared: "لم تتم مشاركة أي بيانات موقع بعد.",
    couldNotLoadLocations: "تعذر تحميل مواقع الموظفين.",
    justNow: "الآن",
    minutesAgo: "منذ %n% دقيقة",
    hoursAgo: "منذ %n% ساعة",
    daysAgo: "منذ %n% يوم",
    locationSharingTitle: "مشاركة الموقع",
    locationSharingNote: "تتم مشاركة موقعك مع فريق الإدارة.",
    locationRequesting: "جارٍ الطلب…",
    locationActive: "نشط",
    locationDenied: "محظور — فعّل الوصول إلى الموقع في متصفحك",
    locationUnsupported: "غير مدعوم على هذا الجهاز",
    mapStreetLabel: "خريطة الشوارع",
    mapSatelliteLabel: "قمر صناعي",
    accuracyLabel: "الدقة ضمن ~%n% متر",

    // Extra keys for admin.js dynamic content
    okBtn: "موافق",
    confirmBtn: "تأكيد",
    loadingText: "جارٍ التحميل…",
    couldNotLoadLeaveRequests: "تعذر تحميل طلبات الإجازة.",
    colFileNumber: "الرقم الوظيفي",
    colEmail: "البريد الإلكتروني",
    colHiringDate: "تاريخ التعيين",
    colDob: "تاريخ الميلاد",
    colNationality: "الجنسية",
    colEducation: "المؤهل العلمي",
    colSalary: "الراتب",
    colAnnualLeaveDays: "أيام الإجازة السنوية",
    colTakenThisYear: "المستخدم هذا العام",
    colSickLeaveDays: "أيام الإجازة المرضية",
    colSickTakenThisYear: "المرضي المستخدم هذا العام",
    resetPasswordConfirmMsg: "إنشاء كلمة مرور جديدة لـ %name%؟ ستتوقف كلمة المرور الحالية عن العمل.",
    couldNotResetPasswordToast: "تعذر إعادة تعيين كلمة المرور.",
    newPasswordGeneratedMsg: "%name% (رقم %fileNumber%) — كلمة المرور الجديدة: <strong>%password%</strong><br><br>شارك هذه البيانات معه بطريقة آمنة.",
    deleteEmployeeConfirmMsg: "حذف %name% (رقم %fileNumber%)؟ سيؤدي هذا إلى إزالة تسجيل دخوله وسجلاته نهائيًا. لا يمكن التراجع عن هذا.",
    companyScopedTitleSuffix: "الموظفون",
    companyScopedSub: "أضف موظفي ومشرفي %company% وأدرهم وأصدر تقاريرهم فقط.",
  }
};

function getLang() {
  return localStorage.getItem("fwx_lang") || "en";
}

function setLang(lang) {
  localStorage.setItem("fwx_lang", lang);
}

function t(key) {
  const lang = getLang();
  return (translations[lang] && translations[lang][key] !== undefined ? translations[lang][key] : translations.en[key]) || key;
}

// Like t(), but replaces %varName% placeholders with values from `vars`.
function tv(key, vars) {
  let str = t(key);
  for (const k in vars) {
    str = str.split(`%${k}%`).join(vars[k]);
  }
  return str;
}

function applyTranslations() {
  const lang = getLang();
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });
  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    document.title = t(el.getAttribute("data-i18n-title"));
  });
  document.querySelectorAll(".lang-toggle").forEach(btn => {
    btn.textContent = lang === "ar" ? t("langToggleToEn") : t("langToggleToAr");
  });
}

function initLangToggle() {
  applyTranslations();
  document.querySelectorAll(".lang-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      setLang(getLang() === "ar" ? "en" : "ar");
      window.location.reload();
    });
  });
}

// Shows/hides a small spinner on a button while an async action runs, and
// disables the button so it can't be clicked twice. loadingLabel is optional
// text shown next to the spinner (e.g. "Saving…"); if omitted, the spinner
// shows alone.
function setBtnLoading(btn, loading, loadingLabel) {
  if (!btn) return;
  if (loading) {
    if (btn.dataset.origText === undefined) btn.dataset.origText = btn.textContent;
    btn.innerHTML = `<span class="btn-spinner"></span>${loadingLabel || ""}`;
    btn.classList.add("is-loading");
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.origText !== undefined ? btn.dataset.origText : btn.textContent;
    delete btn.dataset.origText;
    btn.classList.remove("is-loading");
    btn.disabled = false;
  }
}

// Adds the same animated spectrum-of-light background used on the login
// screen to every inner app page (admin/supervisor/staff), minus the
// floating logo — that stays exclusive to login. Skips login pages entirely
// since they already build their own version of this background directly
// in HTML.
(function injectAppBackground() {
  const appEl = document.querySelector(".app");
  if (!appEl || document.querySelector(".login-wrap")) return;
  const bg = document.createElement("div");
  bg.className = "app-bg";
  bg.innerHTML = `
    <div class="login-spectrum"></div>
    <div class="login-lightorb login-lightorb-1"></div>
    <div class="login-lightorb login-lightorb-2"></div>
    <div class="login-lightorb login-lightorb-3"></div>
    <div class="login-lightorb login-lightorb-4"></div>
    <div class="login-mist"></div>
  `;
  appEl.insertBefore(bg, appEl.firstChild);
})();

// A small confirmation modal for logout, available on every page. Returns a
// Promise<boolean> resolved once the user picks Cancel or Log out.
(function injectLogoutConfirm() {
  const div = document.createElement("div");
  div.id = "fwxLogoutConfirmOverlay";
  div.className = "modal-overlay";
  div.style.display = "none";
  div.innerHTML = `
    <div class="modal-box" style="max-width:380px">
      <h2 id="fwxLogoutConfirmTitle" style="margin:0 0 10px"></h2>
      <p id="fwxLogoutConfirmMsg" style="margin:0 0 20px; color:var(--ink-soft); font-size:14.5px"></p>
      <div style="display:flex; gap:10px; justify-content:flex-end">
        <button type="button" class="btn btn-blue btn-sm" id="fwxLogoutCancelBtn" data-skip-confirm="1"></button>
        <button type="button" class="btn btn-danger btn-sm" id="fwxLogoutConfirmBtn"></button>
      </div>
    </div>
  `;
  document.body.appendChild(div);
})();

function showLogoutConfirm() {
  return new Promise((resolve) => {
    const overlay = document.getElementById("fwxLogoutConfirmOverlay");
    document.getElementById("fwxLogoutConfirmTitle").textContent = t("logoutConfirmTitle");
    document.getElementById("fwxLogoutConfirmMsg").textContent = t("logoutConfirmMsg");
    const cancelBtn = document.getElementById("fwxLogoutCancelBtn");
    const confirmBtn = document.getElementById("fwxLogoutConfirmBtn");
    cancelBtn.textContent = "Discard";
    confirmBtn.textContent = t("logout");
    cancelBtn.onclick = () => { overlay.style.display = "none"; resolve(false); };
    confirmBtn.onclick = () => { overlay.style.display = "none"; resolve(true); };
    overlay.style.display = "flex";
  });
}

// ------------------------------------------------------------
// System-wide "confirm before Close/Cancel" — any button marked with
// data-confirm-close on ANY page automatically gets a confirmation prompt
// before it's allowed to actually run. No other code changes are needed:
// the original close/cancel handler already wired to that button still
// runs exactly as before, just one click later (after the admin confirms).
(function injectCloseConfirm() {
  const div = document.createElement("div");
  div.id = "fwxCloseConfirmOverlay";
  div.className = "modal-overlay";
  div.style.display = "none";
  div.innerHTML = `
    <div class="modal-box" style="max-width:380px">
      <h2 id="fwxCloseConfirmTitle" style="margin:0 0 10px"></h2>
      <p id="fwxCloseConfirmMsg" style="margin:0 0 20px; color:var(--ink-soft); font-size:14.5px"></p>
      <div style="display:flex; gap:10px; justify-content:flex-end">
        <button type="button" class="btn btn-primary btn-sm" id="fwxCloseConfirmStayBtn" data-skip-confirm="1">Stay</button>
        <button type="button" class="btn btn-danger btn-sm" id="fwxCloseConfirmProceedBtn" data-skip-confirm="1">Yes, Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);
})();

function showCloseConfirm() {
  return new Promise((resolve) => {
    const overlay = document.getElementById("fwxCloseConfirmOverlay");
    document.getElementById("fwxCloseConfirmTitle").textContent = "Close?";
    document.getElementById("fwxCloseConfirmMsg").textContent = "Are you sure you want to close this? Any unsaved changes may be lost.";
    document.getElementById("fwxCloseConfirmStayBtn").onclick = () => { overlay.style.display = "none"; resolve(false); };
    document.getElementById("fwxCloseConfirmProceedBtn").onclick = () => { overlay.style.display = "none"; resolve(true); };
    overlay.style.display = "flex";
  });
}

// Capture phase runs before the button's own click handler, so we can
// pause the click, ask for confirmation, and only let the original
// handler run afterward if the admin actually confirms.
//
// "Close" buttons never require confirmation, anywhere in the system —
// they just dismiss a view or notification, exactly like an OK button.
// This is id-based ("close" in the button's id) so it automatically covers
// every Close button on every page, including ones added later, without
// needing to touch individual HTML files.
//
// "Cancel" buttons still verify, since those sit on forms where input
// could genuinely be lost. A button gets the Cancel treatment via:
//  1. Explicit opt-in: data-confirm-close="1" on the element.
//  2. Automatic: any <button> whose id contains "cancel" (case-insensitive).
//
// Buttons that already have their own bespoke confirm-before-action logic
// (e.g. the Add Employee wizard's Cancel) should be marked
// data-skip-confirm="1" so they don't get double-prompted.
document.addEventListener("click", async function (e) {
  const btn = e.target.closest("button");
  if (!btn) return;
  if (btn.dataset.skipConfirm === "1") return;

  const idLooksLikeClose = btn.id && /close/i.test(btn.id);
  if (idLooksLikeClose) return;

  const explicitlyMarked = btn.hasAttribute("data-confirm-close");
  const idLooksLikeCancel = btn.id && /cancel/i.test(btn.id);
  if (!explicitlyMarked && !idLooksLikeCancel) return;

  if (btn.dataset.fwxConfirmed === "1") {
    delete btn.dataset.fwxConfirmed;
    return;
  }
  e.preventDefault();
  e.stopImmediatePropagation();
  const ok = await showCloseConfirm();
  if (ok) {
    btn.dataset.fwxConfirmed = "1";
    btn.click();
  }
}, true);

// A full-page dimmed spinner for actions that don't have one specific button
// to attach a spinner to (e.g. a confirm-modal action like freeze/delete,
// where the modal has already closed by the time the request runs).
(function injectGlobalSpinner() {
  const div = document.createElement("div");
  div.id = "fwxGlobalSpinnerOverlay";
  div.style.cssText = "display:none; position:fixed; inset:0; background:rgba(255,255,255,.55); z-index:9999; align-items:center; justify-content:center;";
  div.innerHTML = '<div style="width:38px;height:38px;border:4px solid #d8dee6;border-top-color:#14B8A6;border-radius:50%;animation:fwx-spin .7s linear infinite;"></div>';
  document.body.appendChild(div);
})();
function showGlobalSpinner() {
  const el = document.getElementById("fwxGlobalSpinnerOverlay");
  if (el) el.style.display = "flex";
}
function hideGlobalSpinner() {
  const el = document.getElementById("fwxGlobalSpinnerOverlay");
  if (el) el.style.display = "none";
}

// Apply immediately so static markup is translated before the page-specific
// script runs (which may itself call t() while building dynamic content).
applyTranslations();

// ------------------------------------------------------------
// System-wide: center-align any table column whose cells are purely numeric
// (e.g. "14", "4.98", or a "—" placeholder standing in for a number),
// leaving genuine text columns left-aligned — which is already the default
// everywhere (th{text-align:left} in style.css, and browsers default td to
// left too). Column headers are aligned to match their own column's data.
// Works automatically on every table on every page (admin, supervisor,
// employee), including tables built or re-rendered dynamically after load —
// no per-table code changes needed anywhere.
function isNumericCellContent(text) {
  const trimmed = (text || "").trim();
  if (trimmed === "" || trimmed === "—" || trimmed === "-") return true;
  return /^-?\d+(\.\d+)?%?$/.test(trimmed);
}

function alignNumericTableColumns(root) {
  const tables = (root || document).querySelectorAll("table");
  tables.forEach(table => {
    const bodyRows = table.querySelectorAll("tbody tr");
    if (bodyRows.length === 0) return;

    const colCount = Math.max(...Array.from(bodyRows).map(r => r.children.length));
    const numericVotes = new Array(colCount).fill(0);
    const totalVotes = new Array(colCount).fill(0);

    bodyRows.forEach(row => {
      Array.from(row.children).forEach((td, i) => {
        if (td.querySelector("button, a, input, select, textarea")) return;
        totalVotes[i]++;
        if (isNumericCellContent(td.textContent)) numericVotes[i]++;
      });
    });

    for (let i = 0; i < colCount; i++) {
      const isNumericCol = totalVotes[i] > 0 && numericVotes[i] === totalVotes[i];
      if (!isNumericCol) continue;
      bodyRows.forEach(row => {
        const td = row.children[i];
        if (td && !td.querySelector("button, a, input, select, textarea")) {
          td.style.textAlign = "center";
        }
      });
      const headerRow = table.querySelector("thead tr");
      if (headerRow && headerRow.children[i]) {
        headerRow.children[i].style.textAlign = "center";
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", () => alignNumericTableColumns(document));

// Tables are usually rebuilt via body.innerHTML="" followed by many
// appendChild(tr) calls in a tight loop — debounce so we re-align once
// after that burst settles, rather than on every single row insert.
const fwxTableAlignObserver = new MutationObserver((mutations) => {
  let shouldRealign = false;
  for (const m of mutations) {
    m.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      if (node.tagName === "TR" || (node.querySelectorAll && node.querySelectorAll("tr").length)) shouldRealign = true;
    });
  }
  if (shouldRealign) {
    clearTimeout(fwxTableAlignObserver._pending);
    fwxTableAlignObserver._pending = setTimeout(() => alignNumericTableColumns(document), 50);
  }
});
fwxTableAlignObserver.observe(document.body, { childList: true, subtree: true });

// ------------------------------------------------------------
// System-wide: any Prev/Next pagination button (id ending in "PrevBtn" or
// "NextBtn" — the naming convention already used consistently everywhere)
// gets the shared grey .btn-paginate style, regardless of whatever class
// it currently has in that page's HTML. Covers every page automatically.
function applyPaginationButtonStyle(root) {
  const buttons = (root || document).querySelectorAll('button[id$="PrevBtn"], button[id$="NextBtn"]');
  buttons.forEach(btn => {
    // Wizard step navigation (e.g. empWizardNextBtn, leaveWizardNextBtn)
    // shares the same "...NextBtn"/"...PrevBtn" suffix convention as table
    // pagination, but should keep its own Back(blue)/Next(green) colors —
    // only genuine table pagination buttons get the grey style.
    if (/wizard/i.test(btn.id)) return;
    btn.classList.remove("btn-blue", "btn-primary", "btn-danger");
    if (!btn.classList.contains("btn-paginate")) btn.classList.add("btn-paginate");
  });
}

document.addEventListener("DOMContentLoaded", () => applyPaginationButtonStyle(document));

const fwxPaginationBtnObserver = new MutationObserver((mutations) => {
  for (const m of mutations) {
    m.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      if (node.matches && (node.matches('button[id$="PrevBtn"]') || node.matches('button[id$="NextBtn"]'))) {
        applyPaginationButtonStyle(node.parentNode || document);
      } else if (node.querySelectorAll) {
        applyPaginationButtonStyle(node);
      }
    });
  }
});
fwxPaginationBtnObserver.observe(document.body, { childList: true, subtree: true });

// ------------------------------------------------------------
// System-wide: whenever a table search box yields zero results, show a
// toast the same way we already do for "no matching employee" on report
// filters. Tracks state on the input itself so it fires once when results
// actually disappear, not again on every further keystroke while still empty.
// ------------------------------------------------------------
// System-wide: a centered popup (matching the same visual style as the
// "new warning" / "new contract" notifications) used for informational
// messages that deserve more attention than a small corner toast — e.g.
// "no results found". Injects itself once per page, on first use.
function ensureInfoPopup() {
  let overlay = document.getElementById("fwxInfoPopupOverlay");
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "fwxInfoPopupOverlay";
  overlay.className = "modal-overlay";
  overlay.style.display = "none";
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:420px; text-align:center">
      <div style="font-size:34px; margin-bottom:6px" id="fwxInfoPopupIcon">🔍</div>
      <h2 style="margin:0 0 10px" id="fwxInfoPopupTitle"></h2>
      <p class="help-text" id="fwxInfoPopupText" style="margin-bottom:18px"></p>
      <button type="button" class="btn btn-primary" id="fwxInfoPopupOkBtn">${t("ok")}</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("fwxInfoPopupOkBtn").addEventListener("click", () => {
    overlay.style.display = "none";
  });
  return overlay;
}

function showInfoPopup(title, message, icon) {
  const overlay = ensureInfoPopup();
  document.getElementById("fwxInfoPopupIcon").textContent = icon || "🔍";
  document.getElementById("fwxInfoPopupTitle").textContent = title;
  document.getElementById("fwxInfoPopupText").textContent = message;
  overlay.style.display = "flex";
}

function notifyIfNoSearchResults(inputEl, query, resultCount) {
  if (!inputEl) return;
  if (query && resultCount === 0) {
    if (inputEl.dataset.noResultsShown !== "1") {
      showInfoPopup(t("noResultsTitle"), t("noSearchResultsToast"));
      inputEl.dataset.noResultsShown = "1";
    }
  } else {
    inputEl.dataset.noResultsShown = "";
  }
}
