
/* ============================================================
   LeaveFlow - Dashboard Application
   All database operations use Flask API through Store / Auth.
============================================================ */

let me = Auth.current();

// Returns today's date in YYYY-MM-DD format
function todayISO() {
    const d = new Date();if (!me) {
    location.replace("login.html");
}
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}
// Calculate the total number of leave days (including both dates)
function daysBetween(fromDate, toDate) {
    const from = fromDate.split("-").map(Number);
    const to = toDate.split("-").map(Number);

    const start = Date.UTC(from[0], from[1] - 1, from[2]);
    const end = Date.UTC(to[0], to[1] - 1, to[2]);

    return Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

if (!me) {
    location.replace("login.html");
}

let page = "dashboard";
let q = "";
let fStatus = "All";
let fType = "All";
let fDept = "All";
let fRole = "All";

let calDate = new Date();
let formCfg = null;
let lastUnread = 0;

const isAdmin = () => me && me.role === "Administrator";

const deptName = id =>
    (Store.find("departments", id) || {}).name || "-";

const empOf = id =>
    Store.find("employees", id) || {
        name: "(deleted)",
        department_id: 0
    };

const typeName = id =>
    (Store.find("leave_types", id) || {}).name || "-";

const year = () => todayISO().slice(0, 4);


/* ================= BUSINESS RULES ================= */

const sumDays = (empId, typeId, statuses) => {
    return Store.where("leave_requests", r =>
        Number(r.employee_id) === Number(empId) &&
        Number(r.leave_type_id) === Number(typeId) &&
        statuses.includes(r.status) &&
        r.from_date.startsWith(year())
    ).reduce((sum, r) => sum + Number(r.days || 0), 0);
};

const allowed = typeId => {
    const type = Store.find("leave_types", typeId);
    return type ? Number(type.days_per_year) : 0;
};

const remaining = (employeeId, typeId) => {
    return allowed(typeId) -
        sumDays(employeeId, typeId, ["Approved", "Pending"]);
};


/* ================= NAVIGATION ================= */

const MENU = {
    Administrator: [
        ["MAIN"],
        ["dashboard", "home", "Dashboard"],
        ["requests", "file", "Leave requests"],
        ["calendar", "calendar", "Leave calendar"],
        ["MANAGE"],
        ["employees", "users", "Employees"],
        ["departments", "briefcase", "Departments"],
        ["leave_types", "tag", "Leave types"],
        ["balances", "pie", "Leave balances"],
        ["ACCOUNT"],
        ["profile", "user", "My profile"]
    ],

    Employee: [
        ["MAIN"],
        ["dashboard", "home", "Dashboard"],
        ["requests", "file", "My leave requests"],
        ["calendar", "calendar", "Leave calendar"],
        ["balances", "pie", "My leave balance"],
        ["ACCOUNT"],
        ["profile", "user", "My profile"]
    ]
};

const pageTitle = p =>
    (MENU[me.role].find(m => m[0] === p) || [])[2] || "Dashboard";


/* ================= UI BUILDERS ================= */

const head = (h, p, right = "") =>
    `<div class="page-head">
        <div>
            <h2>${h}</h2>
            <p>${p}</p>
        </div>
        ${right}
    </div>`;

const stat = (ic, cls, val, label, note) =>
    `<div class="card stat">
        <div class="stat-ico ${cls}">${icon(ic, 24)}</div>
        <div>
            <div class="stat-val ${typeof val === "number" ? "count" : ""}"
                 data-to="${val}">
                ${typeof val === "number" ? pad(val) : val}
            </div>
            <div class="stat-label">${label}</div>
            <div class="stat-note">${note}</div>
        </div>
    </div>`;

const card = (h, p, right, body) =>
    `<div class="card">
        <div class="card-head">
            <div>
                <h3>${h}</h3>
                ${p ? `<p>${p}</p>` : ""}
            </div>
            ${right || ""}
        </div>
        ${body}
    </div>`;

const table = (cols, rows) =>
    `<div class="table-wrap">
        <table>
            <thead>
                <tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr>
            </thead>
            <tbody>
                ${rows || `<tr><td class="empty" colspan="${cols.length}">No records found.</td></tr>`}
            </tbody>
        </table>
    </div>`;

const badge = s => `<span class="badge ${s}">${s}</span>`;

const person = (e, sub) =>
    `<div class="person">
        ${avatar(e.name, 34)}
        <div>
            <b>${esc(e.name)}</b>
            <small>${esc(sub)}</small>
        </div>
    </div>`;

const searchBox = ph =>
    `<input class="input search" id="searchBox"
        placeholder="${ph}" value="${esc(q)}">`;

const select = (key, val, opts) =>
    `<select class="input" data-filter="${key}">
        ${opts.map(o =>
            `<option value="${esc(o[0])}"
                ${String(o[0]) === String(val) ? "selected" : ""}>
                ${esc(o[1])}
            </option>`
        ).join("")}
    </select>`;

const reviewBtns = id =>
    `<div class="actions">
        <button class="btn btn-sm btn-ok"
            data-act="review" data-decision="Approved" data-id="${id}">
            Approve
        </button>
        <button class="btn btn-sm btn-no"
            data-act="review" data-decision="Rejected" data-id="${id}">
            Reject
        </button>
    </div>`;


/* ================= CHARTS ================= */

function ring(value, total, label) {
    const C = 2 * Math.PI * 34;
    const off = C * (1 - Math.max(0, value) / total);

    return `<div class="ring">
        <svg width="86" height="86" viewBox="0 0 86 86">
            <circle class="bg" cx="43" cy="43" r="34"
                fill="none" stroke-width="9"/>
            <circle class="fg" cx="43" cy="43" r="34"
                fill="none" stroke-width="9"
                stroke-dasharray="${C}"
                style="--c:${C};--o:${off}"
                transform="rotate(-90 43 43)"/>
            <text x="43" y="48" text-anchor="middle"
                font-size="17" font-weight="700" fill="currentColor">
                ${Math.max(0, value)}
            </text>
        </svg>
        <b>${esc(label)}</b>
        <small>${Math.max(0, value)} of ${total} days left</small>
    </div>`;
}

function barChart(data) {
    const W = 560;
    const H = 235;
    const L = 34;
    const B = 30;
    const T = 14;

    const max = Math.max(
        4,
        Math.ceil(Math.max(0, ...data.map(d => d.value)) / 4) * 4
    );

    const n = Math.max(1, data.length);
    const bw = (W - L - 10) / n;

    let s = `<svg class="bars" viewBox="0 0 ${W} ${H}" width="100%">`;

    for (let i = 0; i <= 4; i++) {
        const y = T + (H - T - B) * (1 - i / 4);

        s += `<line x1="${L}" x2="${W - 10}"
            y1="${y}" y2="${y}"/>`;

        s += `<text x="${L - 8}" y="${y + 4}"
            text-anchor="end">${max * i / 4}</text>`;
    }

    data.forEach((d, i) => {
        const h = (H - T - B) * d.value / max;
        const x = L + i * bw + bw * .22;
        const y = H - B - h;

        s += `<rect x="${x}" y="${y}"
            width="${bw * .56}"
            height="${Math.max(h, 2)}"
            rx="6" fill="#6366f1">
            <title>${d.label}: ${d.value} day(s)</title>
        </rect>`;

        s += `<text x="${x + bw * .28}" y="${H - 10}"
            text-anchor="middle">${d.label}</text>`;
    });

    return s + "</svg>";
}

function donut(items) {
    const total = items.reduce((s, i) => s + i.value, 0);
    const C = 2 * Math.PI * 40;

    let cum = 0;

    const arcs = total
        ? items.filter(i => i.value).map(i => {
            const len = C * i.value / total;

            const c = `<circle cx="60" cy="60" r="40"
                fill="none" stroke="${i.color}"
                stroke-width="14"
                stroke-dasharray="${len} ${C - len}"
                stroke-dashoffset="${-cum}"
                transform="rotate(-90 60 60)">
                <title>${i.label}: ${i.value}</title>
            </circle>`;

            cum += len;
            return c;
        }).join("")
        : `<circle cx="60" cy="60" r="40"
            fill="none" stroke="var(--gray-s)" stroke-width="14"/>`;

    return `<div class="donut-wrap">
        <svg class="donut" width="140" height="140" viewBox="0 0 120 120">
            ${arcs}
            <text x="60" y="58" text-anchor="middle"
                font-size="22" font-weight="700" fill="currentColor">
                ${total}
            </text>
            <text x="60" y="74" text-anchor="middle"
                font-size="9" fill="var(--muted)">requests</text>
        </svg>
        <div class="legend">
            ${items.map(i =>
                `<span><i style="background:${i.color}"></i>
                    ${i.label} <b>${i.value}</b>
                </span>`
            ).join("")}
        </div>
    </div>`;
}


/* ================= DASHBOARDS ================= */

function greeting() {
    const h = new Date().getHours();

    return h < 12
        ? "Good morning"
        : h < 17
            ? "Good afternoon"
            : "Good evening";
}


function employeeDashboard() {
    const t = new Date().toISOString().slice(0, 10);

    const mine = Store.where("leave_requests", r =>
        Number(r.employee_id) === Number(me.id)
    ).sort((a, b) => Number(b.id) - Number(a.id));

    const approvedDays = mine
        .filter(r =>
            r.status === "Approved" &&
            r.from_date.startsWith(year())
        )
        .reduce((s, r) => s + Number(r.days || 0), 0);

    const upcoming = mine
        .filter(r =>
            ["Approved", "Pending"].includes(r.status) &&
            r.to_date >= t
        )
        .sort((a, b) => a.from_date.localeCompare(b.from_date));

    const acts = Store.where("notifications", n =>
        Number(n.employee_id) === Number(me.id)
    ).sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 5);

    return `
        <div class="banner">
            <div>
                <h2>${greeting()}, ${esc(me.name.split(" ")[0])}</h2>
                <p>
                    ${upcoming.length
                        ? `Your next leave starts on ${fmt(upcoming[0].from_date)}.`
                        : "You have no upcoming leave. Planning a break?"
                    }
                </p>
            </div>
            <button class="btn" data-act="apply">
                ${icon("plus", 18)} Apply for leave
            </button>
        </div>

        <div class="grid-4">
            ${stat("clock", "c-amber",
                mine.filter(r => r.status === "Pending").length,
                "Pending requests", "Waiting for approval")}

            ${stat("check", "c-green",
                approvedDays, "Approved days", "Taken this year")}

            ${stat("xcircle", "c-red",
                mine.filter(r => r.status === "Rejected").length,
                "Rejected requests", "All time")}

            ${stat("calendar", "c-pri",
                upcoming.length ? fmtShort(upcoming[0].from_date) : "None",
                "Next leave",
                upcoming.length ? typeName(upcoming[0].leave_type_id) : "No upcoming leave")}
        </div>

        ${card(
            "Leave balance",
            `Remaining days for ${year()}`,
            "",
            `<div class="rings">
                ${Store.all("leave_types").map(t =>
                    ring(remaining(me.id, t.id), t.days_per_year, t.name)
                ).join("")}
            </div>`
        )}

        <div class="grid-main">
            ${card(
                "Recent leave requests",
                "Your latest applications",
                `<button class="link" data-go="requests">View all</button>`,
                table(
                    ["Type", "From", "To", "Days", "Status"],
                    mine.slice(0, 5).map(r =>
                        `<tr>
                            <td>${typeName(r.leave_type_id)}</td>
                            <td>${fmt(r.from_date)}</td>
                            <td>${fmt(r.to_date)}</td>
                            <td>${r.days}</td>
                            <td>${badge(r.status)}</td>
                        </tr>`
                    ).join("")
                )
            )}

            ${card(
                "Recent activity",
                "Notifications for you",
                "",
                acts.length
                    ? `<ul class="timeline">
                        ${acts.map(a =>
                            `<li>
                                <i></i>
                                <div>
                                    ${esc(a.message)}
                                    <small>${ago(a.created_at)}</small>
                                </div>
                            </li>`
                        ).join("")}
                    </ul>`
                    : `<div class="empty">No activity yet.</div>`
            )}
        </div>
    `;
}


function adminDashboard() {
    const all = Store.all("leave_requests");
    const t = todayISO();
    const month = t.slice(0, 7);

    const pending = all
        .filter(r => r.status === "Pending")
        .sort((a, b) => Number(b.id) - Number(a.id));

    const away = all.filter(r =>
        r.status === "Approved" &&
        r.from_date <= t &&
        r.to_date >= t
    );

    const months = [];

    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);

        months.push({
            key: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"),
            label: d.toLocaleDateString("en-IN", { month: "short" })
        });
    }

    const chart = months.map(m => ({
        label: m.label,
        value: all
            .filter(r =>
                ["Approved", "Pending"].includes(r.status) &&
                r.from_date.startsWith(m.key)
            )
            .reduce((s, r) => s + Number(r.days || 0), 0)
    }));

    const cnt = s => all.filter(r => r.status === s).length;

    const byDept = Store.all("departments").map(d => ({
        name: d.name,
        days: all
            .filter(r =>
                r.status === "Approved" &&
                r.from_date.startsWith(year()) &&
                Number(empOf(r.employee_id).department_id) === Number(d.id)
            )
            .reduce((s, r) => s + Number(r.days || 0), 0)
    }));

    const maxD = Math.max(1, ...byDept.map(d => d.days));

    const byType = Store.all("leave_types").map(l => ({
        name: l.name,
        n: all.filter(r =>
            Number(r.leave_type_id) === Number(l.id) &&
            r.status !== "Cancelled"
        ).length
    }));

    const maxT = Math.max(1, ...byType.map(d => d.n));

    return `
        <div class="banner">
            <div>
                <h2>${greeting()}, ${esc(me.name.split(" ")[0])}</h2>
                <p>
                    ${pending.length
                        ? `${pending.length} leave request(s) are waiting for your decision.`
                        : "All caught up. No pending requests."
                    }
                </p>
            </div>
            <button class="btn" data-go="requests">Review requests</button>
        </div>

        <div class="grid-4">
            ${stat("users", "c-pri",
                Store.where("employees", e => e.status === "Active").length,
                "Active employees", "Registered in system")}

            ${stat("clock", "c-amber",
                pending.length, "Pending requests", "Need your attention")}

            ${stat("sun", "c-blue",
                away.length, "On leave today", "Approved leave")}

            ${stat("check", "c-green",
                all.filter(r =>
                    r.status === "Approved" &&
                    r.from_date.startsWith(month)
                ).length,
                "Approved this month", "Leave requests")}
        </div>

        <div class="grid-main">
            ${card(
                "Leave days per month",
                "Approved and pending days, last 6 months",
                "",
                barChart(chart)
            )}

            ${card(
                "Request status",
                "All requests",
                "",
                donut([
                    { label: "Approved", value: cnt("Approved"), color: "#16a34a" },
                    { label: "Pending", value: cnt("Pending"), color: "#d97706" },
                    { label: "Rejected", value: cnt("Rejected"), color: "#dc2626" },
                    { label: "Cancelled", value: cnt("Cancelled"), color: "#94a3b8" }
                ])
            )}
        </div>

        <div class="grid-main">
            ${card(
                "Requests awaiting review",
                "Approve or reject directly from here",
                `<button class="link" data-go="requests">View all</button>`,
                table(
                    ["Employee", "Type", "Dates", "Days", "Action"],
                    pending.slice(0, 5).map(r => {
                        const e = empOf(r.employee_id);

                        return `<tr>
                            <td>${person(e, deptName(e.department_id))}</td>
                            <td>${typeName(r.leave_type_id)}</td>
                            <td>${fmtShort(r.from_date)} – ${fmtShort(r.to_date)}</td>
                            <td>${r.days}</td>
                            <td>${reviewBtns(r.id)}</td>
                        </tr>`;
                    }).join("")
                )
            )}

            ${card(
                "On leave today",
                "Approved leave covering today",
                "",
                away.length
                    ? away.map(r => {
                        const e = empOf(r.employee_id);

                        return `<div class="list-item">
                            ${avatar(e.name, 36)}
                            <div>
                                <b>${esc(e.name)}</b>
                                <small>${typeName(r.leave_type_id)}</small>
                            </div>
                            <div class="end">
                                <small>Back after</small>
                                <b>${fmtShort(r.to_date)}</b>
                            </div>
                        </div>`;
                    }).join("")
                    : `<div class="empty">Everyone is at work today.</div>`
            )}
        </div>

        <div class="grid-half">
            ${card(
                "Leave days by department",
                `Approved days in ${year()}`,
                "",
                byDept.map(d =>
                    `<div class="hbar">
                        <div>
                            <span>${esc(d.name)}</span>
                            <b>${d.days} days</b>
                        </div>
                        <div class="track">
                            <i style="width:${d.days / maxD * 100}%"></i>
                        </div>
                    </div>`
                ).join("")
            )}

            ${card(
                "Requests by leave type",
                "All time (excluding cancelled)",
                "",
                byType.map(d =>
                    `<div class="hbar">
                        <div>
                            <span>${esc(d.name)}</span>
                            <b>${d.n}</b>
                        </div>
                        <div class="track">
                            <i style="width:${d.n / maxT * 100}%"></i>
                        </div>
                    </div>`
                ).join("")
            )}
        </div>
    `;
}


/* ================= LEAVE REQUESTS ================= */

function requestsPage() {
    let list = Store.all("leave_requests")
        .sort((a, b) => Number(b.id) - Number(a.id));

    if (!isAdmin()) {
        list = list.filter(r =>
            Number(r.employee_id) === Number(me.id)
        );
    }

    if (fStatus !== "All") {
        list = list.filter(r => r.status === fStatus);
    }

    if (fType !== "All") {
        list = list.filter(r =>
            Number(r.leave_type_id) === Number(fType)
        );
    }

    if (isAdmin() && fDept !== "All") {
        list = list.filter(r =>
            Number(empOf(r.employee_id).department_id) === Number(fDept)
        );
    }

    if (q) {
        list = list.filter(r =>
            (
                empOf(r.employee_id).name +
                typeName(r.leave_type_id) +
                r.reason
            ).toLowerCase().includes(q.toLowerCase())
        );
    }

    const tools = `
        <div class="toolbar">
            ${searchBox("Search requests...")}

            ${select("status", fStatus, [
                ["All", "All statuses"],
                ...["Pending", "Approved", "Rejected", "Cancelled"]
                    .map(s => [s, s])
            ])}

            ${select("type", fType, [
                ["All", "All types"],
                ...Store.all("leave_types").map(t => [t.id, t.name])
            ])}

            ${isAdmin()
                ? select("dept", fDept, [
                    ["All", "All departments"],
                    ...Store.all("departments").map(d => [d.id, d.name])
                ])
                : ""
            }
        </div>
    `;

    const rows = list.map(r => {
        const e = empOf(r.employee_id);

        return isAdmin()
            ? `<tr>
                <td>${person(e, deptName(e.department_id))}</td>
                <td>${typeName(r.leave_type_id)}</td>
                <td>${fmt(r.from_date)} – ${fmt(r.to_date)}</td>
                <td>${r.days}</td>
                <td title="${esc(r.reason)}">
                    ${esc(
                        r.reason.length > 26
                            ? r.reason.slice(0, 26) + "…"
                            : r.reason
                    )}
                </td>
                <td>
                    ${r.status === "Pending"
                        ? reviewBtns(r.id)
                        : badge(r.status)
                    }
                </td>
                <td>${esc(r.remarks || "") || "-"}</td>
            </tr>`
            : `<tr>
                <td>${typeName(r.leave_type_id)}</td>
                <td>${fmt(r.from_date)}</td>
                <td>${fmt(r.to_date)}</td>
                <td>${r.days}</td>
                <td>${esc(r.reason)}</td>
                <td>${badge(r.status)}</td>
                <td>${esc(r.remarks || "") || "-"}</td>
                <td>
                    ${r.status === "Pending"
                        ? `<button class="btn btn-sm btn-muted"
                            data-act="cancel" data-id="${r.id}">
                            Cancel
                           </button>`
                        : ""
                    }
                </td>
            </tr>`;
    }).join("");

    return head(
        isAdmin() ? "Leave requests" : "My leave requests",
        isAdmin()
            ? "Review and manage leave applications from all employees."
            : "Track the status of your leave applications.",
        isAdmin()
            ? `<button class="btn btn-ghost" data-act="export">
                ${icon("download", 16)} Export CSV
               </button>`
            : `<button class="btn btn-primary" data-act="apply">
                ${icon("plus", 18)} Apply for leave
               </button>`
    ) +
    card(
        "Application records",
        `${list.length} record(s) from the leave_requests table`,
        tools,
        table(
            isAdmin()
                ? ["Employee", "Type", "Dates", "Days", "Reason", "Status / Action", "Remarks"]
                : ["Type", "From", "To", "Days", "Reason", "Status", "Remarks", ""],
            rows
        )
    );
}


function applyForm() {
    openForm({
        title: "Apply for leave",
        sub: "Enter the details of your leave request.",
        submit: "Submit request",

        fields: [
            {
                k: "leave_type_id",
                l: "Leave type",
                type: "select",
                opts: Store.all("leave_types").map(t => ({
                    v: t.id,
                    t: `${t.name} - ${Math.max(0, remaining(me.id, t.id))} days left`
                }))
            },
            {
                k: "from_date",
                l: "From date",
                type: "date",
                half: true,
                min: todayISO()
            },
            {
                k: "to_date",
                l: "To date",
                type: "date",
                half: true,
                min: todayISO()
            },
            {
                k: "reason",
                l: "Reason",
                type: "textarea"
            }
        ],

        save(v) {
            const typeId = Number(v.leave_type_id);

            if (v.to_date < v.from_date) {
                return "To date must be the same as or later than the from date.";
            }

            const days = daysBetween(v.from_date, v.to_date);

            if (days <= 0) {
                return "Please select valid leave dates.";
            }

            const clash = Store.where("leave_requests", r =>
                Number(r.employee_id) === Number(me.id) &&
                ["Pending", "Approved"].includes(r.status) &&
                r.from_date <= v.to_date &&
                r.to_date >= v.from_date
            )[0];

            if (clash) {
                return `These dates overlap with your ${clash.status.toLowerCase()} leave (${fmt(clash.from_date)} – ${fmt(clash.to_date)}).`;
            }

            if (days > remaining(me.id, typeId)) {
                return `Not enough balance. You have ${Math.max(0, remaining(me.id, typeId))} day(s) left for ${typeName(typeId)}.`;
            }

            if (!v.reason.trim()) {
                return "Please enter a reason for your leave.";
            }

            const result = Store.insert("leave_requests", {
                employee_id: me.id,
                leave_type_id: typeId,
                from_date: v.from_date,
                to_date: v.to_date,
                days: days,
                reason: v.reason.trim(),
                status: "Pending",
                applied_on: todayISO(),
                reviewed_by: null,
                reviewed_on: null,
                remarks: ""
            });

            if (!result) {
                return "Could not submit the leave request. Please try again.";
            }

            // MySQL trigger automatically creates admin notifications.
            toast("Leave request submitted.");
            go("requests");
        }
    });
}


function reviewForm(id, decision) {
    const r = Store.find("leave_requests", id);

    if (!r || r.status !== "Pending") {
        toast("This request is no longer pending.", "info");
        return render();
    }

    const e = empOf(r.employee_id);
    const ok = decision === "Approved";

    openForm({
        title: ok ? "Approve request" : "Reject request",

        sub: `${e.name} · ${typeName(r.leave_type_id)} · ${fmt(r.from_date)} – ${fmt(r.to_date)} (${r.days} day/s)`,

        submit: ok ? "Approve" : "Reject",

        fields: [
            {
                k: "remarks",
                l: "Remarks" + (ok ? " (optional)" : " (required)"),
                type: "textarea",
                req: !ok
            }
        ],

        save(v) {
            if (!ok && !v.remarks.trim()) {
                return "Please enter a reason for rejecting this request.";
            }

            const result = Store.update("leave_requests", id, {
                status: decision,
                reviewed_by: me.id,
                reviewed_on: todayISO(),
                remarks: v.remarks.trim()
            });

            if (!result) {
                return "Could not update this request. Please try again.";
            }

            // MySQL trigger automatically notifies the employee.
            toast(`Request ${decision.toLowerCase()}.`, ok ? "ok" : "info");
            render();
        }
    });
}


function exportCSV() {
    const rows = [[
        "Employee",
        "Department",
        "Leave type",
        "From",
        "To",
        "Days",
        "Reason",
        "Status",
        "Applied on",
        "Remarks"
    ]];

    Store.all("leave_requests").forEach(r => {
        const e = empOf(r.employee_id);

        rows.push([
            e.name,
            deptName(e.department_id),
            typeName(r.leave_type_id),
            r.from_date,
            r.to_date,
            r.days,
            r.reason,
            r.status,
            r.applied_on,
            r.remarks
        ]);
    });

    const csv = rows.map(r =>
        r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")
    ).join("\n");

    const a = document.createElement("a");

    a.href = URL.createObjectURL(
        new Blob([csv], { type: "text/csv" })
    );

    a.download = "leave_requests.csv";
    a.click();

    URL.revokeObjectURL(a.href);

    toast("CSV exported.");
}


/* ================= CALENDAR ================= */

function calendarPage() {
    const y = calDate.getFullYear();
    const m = calDate.getMonth();

    const first = new Date(y, m, 1).getDay();
    const dim = new Date(y, m + 1, 0).getDate();
    const t = new Date().toISOString().slice(0, 10);

    const reqs = Store.where("leave_requests", r =>
        ["Approved", "Pending"].includes(r.status) &&
        (
            isAdmin() ||
            Number(r.employee_id) === Number(me.id)
        )
    );

    let cells = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        .map(d => `<div class="dow">${d}</div>`).join("");

    cells += `<div class="cal-day blank"></div>`.repeat(first);

    for (let d = 1; d <= dim; d++) {
        const ds = `${y}-${pad(m + 1)}-${pad(d)}`;
        const dow = new Date(y, m, d).getDay();

        const on = reqs.filter(r =>
            r.from_date <= ds && r.to_date >= ds
        );

        cells += `
            <div class="cal-day ${ds === t ? "today" : ""}
                ${dow === 0 || dow === 6 ? "weekend" : ""}">
                <div class="n">${d}</div>

                ${on.slice(0, 3).map(r =>
                    `<span class="chip ${r.status}"
                        title="${esc(empOf(r.employee_id).name)} · ${typeName(r.leave_type_id)} · ${r.status}">
                        ${esc(
                            isAdmin()
                                ? empOf(r.employee_id).name.split(" ")[0]
                                : typeName(r.leave_type_id)
                        )}
                    </span>`
                ).join("")}

                ${on.length > 3
                    ? `<small style="color:var(--muted)">+${on.length - 3} more</small>`
                    : ""
                }
            </div>
        `;
    }

    return head(
        "Leave calendar",
        isAdmin()
            ? "See who is away across the whole team."
            : "Your approved and pending leave by date."
    ) +
    card(
        calDate.toLocaleDateString("en-IN", {
            month: "long",
            year: "numeric"
        }),
        "",
        `<div class="cal-head">
            <button class="icon-btn" data-act="calprev">
                ${icon("left", 18)}
            </button>
            <button class="btn btn-ghost btn-sm" data-act="caltoday">
                Today
            </button>
            <button class="icon-btn" data-act="calnext">
                ${icon("right", 18)}
            </button>
        </div>`,
        `<div class="cal">${cells}</div>
         <div class="legend-row">
            <span><i style="background:var(--green)"></i>Approved</span>
            <span><i style="background:var(--amber)"></i>Pending</span>
            <span><i style="background:var(--gray-s);border:1px solid var(--border)"></i>Weekend</span>
         </div>`
    );
}


/* ================= CRUD PAGES ================= */

const CRUD = {
    employees: {
        label: "Employee",
        unique: ["email", "emp_code"],

        fields: row => [
            { k: "emp_code", l: "Employee ID", half: true },
            { k: "name", l: "Full name", half: true },
            { k: "email", l: "Email", type: "email", half: true },
            { k: "phone", l: "Phone", half: true, req: false },
            { k: "designation", l: "Designation", half: true, req: false },

            {
                k: "department_id",
                l: "Department",
                type: "select",
                half: true,
                opts: Store.all("departments").map(d => ({
                    v: d.id,
                    t: d.name
                }))
            },

            {
                k: "role",
                l: "Role",
                type: "select",
                half: true,
                opts: ["Employee", "Administrator"]
            },

            {
                k: "status",
                l: "Status",
                type: "select",
                half: true,
                opts: ["Active", "Inactive"]
            },

            { k: "join_date", l: "Joining date", type: "date" },

            {
                k: "password",
                l: row ? "New password (leave blank to keep)" : "Password",
                type: "password",
                req: !row
            }
        ],

        blocked: r => {
            if (Number(r.id) === Number(me.id)) {
                return "You cannot delete your own account.";
            }

            if (Store.where("leave_requests", x =>
                Number(x.employee_id) === Number(r.id)
            ).length) {
                return "Cannot delete: this employee has leave requests. Mark the employee Inactive instead.";
            }

            return null;
        }
    },

    departments: {
        label: "Department",
        unique: ["name"],

        fields: () => [
            { k: "name", l: "Department name" }
        ],

        blocked: r =>
            Store.where("employees", e =>
                Number(e.department_id) === Number(r.id)
            ).length
                ? "Cannot delete: employees still belong to this department."
                : null
    },

    leave_types: {
        label: "Leave type",
        unique: ["name"],

        fields: () => [
            { k: "name", l: "Leave type name" },
            {
                k: "days_per_year",
                l: "Days per year",
                type: "number",
                min: 1
            }
        ],

        blocked: r =>
            Store.where("leave_requests", x =>
                Number(x.leave_type_id) === Number(r.id)
            ).length
                ? "Cannot delete: leave requests use this type."
                : null
    }
};


const addBtn = t =>
    `<button class="btn btn-primary" data-act="add" data-t="${t}">
        ${icon("plus", 18)} Add ${CRUD[t].label.toLowerCase()}
    </button>`;

const rowBtns = (t, id) =>
    `<td>
        <div class="actions">
            <button class="btn btn-sm btn-edit"
                data-act="edit" data-t="${t}" data-id="${id}">
                Edit
            </button>
            <button class="btn btn-sm btn-no"
                data-act="delete" data-t="${t}" data-id="${id}">
                Delete
            </button>
        </div>
    </td>`;


function employeesPage() {
    let list = Store.all("employees");

    if (q) {
        list = list.filter(e =>
            (e.name + e.email + e.emp_code + e.designation)
                .toLowerCase()
                .includes(q.toLowerCase())
        );
    }

    if (fDept !== "All") {
        list = list.filter(e =>
            Number(e.department_id) === Number(fDept)
        );
    }

    if (fRole !== "All") {
        list = list.filter(e => e.role === fRole);
    }

    const tools = `
        <div class="toolbar">
            ${searchBox("Search employees...")}

            ${select("dept", fDept, [
                ["All", "All departments"],
                ...Store.all("departments").map(d => [d.id, d.name])
            ])}

            ${select("role", fRole, [
                ["All", "All roles"],
                ["Employee", "Employee"],
                ["Administrator", "Administrator"]
            ])}
        </div>
    `;

    return head(
        "Employees",
        "Manage employee accounts, roles and departments.",
        addBtn("employees")
    ) +
    card(
        "Employee directory",
        `${list.length} employee(s) in the employees table`,
        tools,
        table(
            ["Employee", "ID", "Department", "Designation", "Role", "Status", "Actions"],
            list.map(e =>
                `<tr>
                    <td>${person(e, e.email)}</td>
                    <td>${esc(e.emp_code || "")}</td>
                    <td>${deptName(e.department_id)}</td>
                    <td>${esc(e.designation || "") || "-"}</td>
                    <td>${badge(e.role)}</td>
                    <td>${badge(e.status)}</td>
                    ${rowBtns("employees", e.id)}
                </tr>`
            ).join("")
        )
    );
}


const departmentsPage = () =>
    head(
        "Departments",
        "Departments that employees belong to.",
        addBtn("departments")
    ) +
    card(
        "All departments",
        "",
        "",
        table(
            ["ID", "Department", "Employees", "Actions"],
            Store.all("departments").map(d =>
                `<tr>
                    <td>${d.id}</td>
                    <td><b>${esc(d.name)}</b></td>
                    <td>
                        ${Store.where("employees", e =>
                            Number(e.department_id) === Number(d.id)
                        ).length}
                    </td>
                    ${rowBtns("departments", d.id)}
                </tr>`
            ).join("")
        )
    );


const leaveTypesPage = () =>
    head(
        "Leave types",
        "Leave categories and their yearly allowance.",
        addBtn("leave_types")
    ) +
    card(
        "All leave types",
        "",
        "",
        table(
            ["ID", "Leave type", "Days per year", "Requests", "Actions"],
            Store.all("leave_types").map(t =>
                `<tr>
                    <td>${t.id}</td>
                    <td><b>${esc(t.name)}</b></td>
                    <td>${t.days_per_year}</td>
                    <td>
                        ${Store.where("leave_requests", r =>
                            Number(r.leave_type_id) === Number(t.id)
                        ).length}
                    </td>
                    ${rowBtns("leave_types", t.id)}
                </tr>`
            ).join("")
        )
    );


function nextCode() {
    const employees = Store.all("employees");

    const max = employees.reduce((m, e) =>
        Math.max(
            m,
            parseInt(String(e.emp_code || "").replace(/\D/g, "")) || 0
        ),
        0
    );

    return "EMP" + String(max + 1).padStart(3, "0");
}


function crudForm(t, id) {
    const cfg = CRUD[t];
    const row = id ? Store.find(t, id) : null;

    const fields = cfg.fields(row).map(f => ({
        ...f,
        value: row
            ? (f.k === "password" ? "" : row[f.k])
            : (
                f.k === "status" ? "Active" :
                f.k === "join_date" ? todayISO() :
                f.k === "emp_code" ? nextCode() :
                ""
            )
    }));

    openForm({
        title: (row ? "Edit " : "Add ") + cfg.label.toLowerCase(),
        sub: "Fill in the details and save.",
        submit: "Save",
        fields,

        save(v) {
            for (const k of cfg.unique) {
                const value = String(v[k] || "").trim().toLowerCase();

                if (Store.where(t, r =>
                    (!row || Number(r.id) !== Number(row.id)) &&
                    String(r[k] || "").trim().toLowerCase() === value
                ).length) {
                    return `${k.replace("_", " ")} "${v[k]}" already exists.`;
                }
            }

            if (
                t === "employees" &&
                row &&
                Number(row.id) === Number(me.id) &&
                (v.status !== "Active" || v.role !== "Administrator")
            ) {
                return "You cannot deactivate or demote your own account.";
            }

            if (t === "employees" && v.password && v.password.length < 6) {
                return "Password must be at least 6 characters.";
            }

            const data = {};

            fields.forEach(f => {
                if (f.k === "password") {
                    // Send the original password to Flask.
                    // Flask/Werkzeug creates the secure password hash.
                    if (v.password) {
                        data.password = v.password;
                    }
                } else {
                    data[f.k] = [
                        "department_id",
                        "days_per_year"
                    ].includes(f.k)
                        ? Number(v[f.k])
                        : String(v[f.k] || "").trim();
                }
            });

            const result = row
                ? Store.update(t, row.id, data)
                : Store.insert(t, data);

            if (!result) {
                return "Could not save the record. Please check the details and try again.";
            }

            toast(cfg.label + (row ? " updated." : " added."));
            render();
        }
    });
}


/* ================= LEAVE BALANCES ================= */

function balancesPage() {
    const types = Store.all("leave_types");

    if (!isAdmin()) {
        return head(
            "My leave balance",
            `Your leave allowance for ${year()}.`
        ) +
        card(
            "Balance rings",
            "",
            "",
            `<div class="rings">
                ${types.map(t =>
                    ring(remaining(me.id, t.id), t.days_per_year, t.name)
                ).join("")}
            </div>`
        ) +
        card(
            "Balance details",
            "Calculated from your approved and pending requests",
            "",
            table(
                ["Leave type", "Allowed", "Used", "Pending", "Remaining"],
                types.map(t =>
                    `<tr>
                        <td><b>${esc(t.name)}</b></td>
                        <td>${t.days_per_year}</td>
                        <td>${sumDays(me.id, t.id, ["Approved"])}</td>
                        <td>${sumDays(me.id, t.id, ["Pending"])}</td>
                        <td><b>${remaining(me.id, t.id)}</b></td>
                    </tr>`
                ).join("")
            )
        );
    }

    let people = Store.where("employees", e => e.status === "Active");

    if (fDept !== "All") {
        people = people.filter(e =>
            Number(e.department_id) === Number(fDept)
        );
    }

    const rows = people.map(e =>
        `<tr>
            <td>${person(e, deptName(e.department_id))}</td>

            ${types.map(t => {
                const u = sumDays(e.id, t.id, ["Approved"]);
                const p = sumDays(e.id, t.id, ["Pending"]);

                return `<td style="min-width:140px">
                    ${u}
                    ${p
                        ? `<small style="color:var(--amber)">+${p} pending</small>`
                        : ""
                    }
                    / ${t.days_per_year}

                    <div class="track" style="margin-top:6px">
                        <i style="width:${Math.min(
                            100,
                            (u + p) / Number(t.days_per_year) * 100
                        )}%"></i>
                    </div>
                </td>`;
            }).join("")}
        </tr>`
    ).join("");

    return head(
        "Leave balances",
        `Days used in ${year()} against the yearly allowance.`
    ) +
    card(
        "Balance summary",
        "Active employees (same logic as the v_leave_balance view)",
        `<div class="toolbar">
            ${select("dept", fDept, [
                ["All", "All departments"],
                ...Store.all("departments").map(d => [d.id, d.name])
            ])}
        </div>`,
        table(
            ["Employee", ...types.map(t => t.name)],
            rows
        )
    );
}


/* ================= PROFILE ================= */

function profilePage() {
    const n = Store.where("leave_requests", r =>
        Number(r.employee_id) === Number(me.id)
    ).length;

    return head(
        "My profile",
        "Manage your personal details and password."
    ) +
    `<div class="card">
        <div class="profile-head">
            ${avatar(me.name, 76)}
            <div>
                <h2>${esc(me.name)}</h2>
                <p>${esc(me.designation || me.role)} · ${esc(me.email)}</p>
            </div>
        </div>

        <div class="meta">
            <div><small>Employee ID</small><b>${esc(me.emp_code || "")}</b></div>
            <div><small>Department</small><b>${esc(deptName(me.department_id))}</b></div>
            <div><small>Role</small><b>${esc(me.role)}</b></div>
            <div><small>Joined</small><b>${fmt(me.join_date)}</b></div>
            <div><small>Requests made</small><b>${n}</b></div>
        </div>
    </div>

    <div class="grid-half">
        ${card(
            "Edit details",
            "",
            "",
            `<form id="profileForm" novalidate>
                <label class="field">
                    Full name
                    <input id="pName" value="${esc(me.name)}" required>
                </label>

                <label class="field">
                    Phone
                    <input id="pPhone" value="${esc(me.phone || "")}">
                </label>

                <p class="form-error" id="pErr"></p>

                <button class="btn btn-primary" type="submit">
                    Save changes
                </button>
            </form>`
        )}

        ${card(
            "Change password",
            "",
            "",
            `<form id="passForm" novalidate>
                <label class="field">
                    Current password
                    <input id="cPass" type="password" required>
                </label>

                <label class="field">
                    New password
                    <input id="nPass" type="password"
                        placeholder="Min. 6 characters" required>
                </label>

                <label class="field">
                    Confirm new password
                    <input id="rPass" type="password" required>
                </label>

                <p class="form-error" id="wErr"></p>

                <button class="btn btn-primary" type="submit">
                    Update password
                </button>
            </form>`
        )}
    </div>`;
}


document.addEventListener("submit", function(e) {
    if (e.target.id === "profileForm") {
        e.preventDefault();

        const name = $("pName").value.trim();
        const phone = $("pPhone").value.trim();

        if (!name) {
            $("pErr").textContent = "Name cannot be empty.";
            return;
        }

        const result = Store.update("employees", me.id, {
            name: name,
            phone: phone
        });

        if (!result) {
            $("pErr").textContent = "Could not update profile.";
            return;
        }

        toast("Profile updated.");
        render();
    }


    if (e.target.id === "passForm") {
        e.preventDefault();

        const currentPassword = $("cPass").value;
        const newPassword = $("nPass").value;
        const confirmPassword = $("rPass").value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            $("wErr").textContent = "Please complete all password fields.";
            return;
        }

        if (newPassword.length < 6) {
            $("wErr").textContent = "New password must be at least 6 characters.";
            return;
        }

        if (newPassword !== confirmPassword) {
            $("wErr").textContent = "New passwords do not match.";
            return;
        }

        const result = Auth.changePassword(
            currentPassword,
            newPassword
        );

        if (!result) {
            $("wErr").textContent = "Could not change password. Check your current password.";
            return;
        }

        toast("Password changed successfully.");
        render();
    }
});


/* ================= MODAL FORM BUILDER ================= */

function openForm(cfg) {
    formCfg = cfg;

    $("mTitle").textContent = cfg.title;
    $("mSub").textContent = cfg.sub;
    $("mSubmit").textContent = cfg.submit || "Save";
    $("mError").textContent = "";

    const input = f => {
        const v = f.value ?? "";
        const req = f.req === false ? "" : "required";

        if (f.type === "select") {
            return `<select name="${f.k}">
                ${f.opts.map(o => {
                    const val = o.v ?? o;
                    const txt = o.t ?? o;

                    return `<option value="${esc(val)}"
                        ${String(val) === String(v) ? "selected" : ""}>
                        ${esc(txt)}
                    </option>`;
                }).join("")}
            </select>`;
        }

        if (f.type === "textarea") {
            return `<textarea name="${f.k}" rows="3" ${req}>${esc(v)}</textarea>`;
        }

        return `<input name="${f.k}"
            type="${f.type || "text"}"
            value="${esc(v)}"
            ${f.min !== undefined ? `min="${f.min}"` : ""}
            ${req}
            ${f.type === "password" ? 'autocomplete="new-password"' : ""}>`;
    };

    const out = [];
    let buf = [];

    const flush = () => {
        if (buf.length) {
            out.push(`<div class="form-row">${buf.join("")}</div>`);
            buf = [];
        }
    };

    cfg.fields.forEach(f => {
        const el = `<label class="field">${f.l}${input(f)}</label>`;

        if (f.half) {
            buf.push(el);

            if (buf.length === 2) {
                flush();
            }
        } else {
            flush();
            out.push(el);
        }
    });

    flush();

    $("mFields").innerHTML = out.join("");
    $("overlay").classList.remove("hidden");

    const first = $("mFields").querySelector("input,select,textarea");

    if (first) {
        first.focus();
    }
}


const closeForm = () =>
    $("overlay").classList.add("hidden");


$("mClose").onclick = $("mCancel").onclick = closeForm;


$("overlay").addEventListener("mousedown", e => {
    if (e.target === $("overlay")) {
        closeForm();
    }
});


document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
        closeForm();
        $("bellDrop").classList.remove("open");
    }
});


$("mForm").addEventListener("submit", e => {
    e.preventDefault();

    const form = $("mForm");

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const error = formCfg.save(
        Object.fromEntries(new FormData(form).entries())
    );

    if (error) {
        $("mError").textContent = error;
    } else {
        closeForm();
    }
});


/* ================= NOTIFICATIONS ================= */

const myNotes = () =>
    Store.where("notifications", n =>
        Number(n.employee_id) === Number(me.id)
    ).sort((a, b) => Number(b.id) - Number(a.id));


function renderBell() {
    const n = myNotes().filter(x => !x.is_read).length;

    $("bellDot").textContent = n;
    $("bellDot").classList.toggle("hidden", !n);

    return n;
}


function openBell() {
    const dd = $("bellDrop");
    const list = myNotes().slice(0, 8);

    if (dd.classList.contains("open")) {
        return dd.classList.remove("open");
    }

    dd.innerHTML = `
        <div class="dd-head">
            <span>Notifications</span>
            <span style="color:var(--muted);font-weight:500">
                ${list.filter(n => !n.is_read).length} new
            </span>
        </div>

        <div class="dd-list">
            ${list.length
                ? list.map(n =>
                    `<div class="dd-item ${n.is_read ? "" : "unread"}">
                        <span style="color:var(--primary)">
                            ${icon("bell", 16)}
                        </span>
                        <div>
                            ${esc(n.message)}
                            <small>${ago(n.created_at)}</small>
                        </div>
                    </div>`
                ).join("")
                : `<div class="dd-empty">No notifications yet.</div>`
            }
        </div>
    `;

    dd.classList.add("open");

    list.filter(n => !n.is_read).forEach(n => {
        Store.update("notifications", n.id, {
            is_read: true
        });
    });

    lastUnread = renderBell();
}


document.addEventListener("click", e => {
    if (!e.target.closest(".drop-wrap")) {
        $("bellDrop").classList.remove("open");
    }
});


/* ================= ROUTING + RENDER ================= */

function renderNav() {
    const pend = Store.where("leave_requests", r =>
        r.status === "Pending"
    ).length;

    $("nav").innerHTML = MENU[me.role].map(m =>
        m.length === 1
            ? `<div class="side-group">${m[0]}</div>`
            : `<button class="nav-item ${m[0] === page ? "active" : ""}"
                data-go="${m[0]}">
                ${icon(m[1], 19)}
                <span>${m[2]}</span>

                ${isAdmin() && m[0] === "requests" && pend
                    ? `<span class="nav-count">${pend}</span>`
                    : ""
                }
            </button>`
    ).join("");
}


function animateCounts() {
    document.querySelectorAll(".count").forEach(el => {
        const to = Number(el.dataset.to);
        const t0 = performance.now();

        const step = now => {
            const p = Math.min(1, (now - t0) / 650);

            el.textContent = pad(
                Math.round(to * (1 - Math.pow(1 - p, 3)))
            );

            if (p < 1) {
                requestAnimationFrame(step);
            }
        };

        requestAnimationFrame(step);
    });
}


function render(anim = false) {
    me = Auth.current();

    if (!me) {
        return location.replace("login.html");
    }

    const views = {
        dashboard: isAdmin() ? adminDashboard : employeeDashboard,
        requests: requestsPage,
        calendar: calendarPage,
        employees: employeesPage,
        departments: departmentsPage,
        leave_types: leaveTypesPage,
        balances: balancesPage,
        profile: profilePage
    };

    if (!MENU[me.role].some(m => m[0] === page)) {
        page = "dashboard";
    }

    $("topTitle").textContent = pageTitle(page);
    $("view").innerHTML = views[page]();

    if (anim) {
        $("view").classList.remove("page-anim");
        void $("view").offsetWidth;
        $("view").classList.add("page-anim");

        animateCounts();
    }

    $("sideUser").innerHTML = `
        ${avatar(me.name, 38)}
        <div>
            <b>${esc(me.name)}</b>
            <small>${me.role}</small>
        </div>
    `;

    $("avatarBtn").innerHTML = avatar(me.name, 40);

    renderNav();
    renderBell();
}


function go(p) {
    q = "";
    fStatus = fType = fDept = fRole = "All";

    $("sidebar").classList.remove("open");
    $("scrim").classList.remove("show");

    if (location.hash.slice(1) === p) {
        page = p;
        render(true);
    } else {
        location.hash = p;
    }
}


window.addEventListener("hashchange", () => {
    page = location.hash.slice(1) || "dashboard";

    q = "";
    fStatus = fType = fDept = fRole = "All";

    render(true);
});


/* ================= CLICK HANDLER ================= */

document.addEventListener("click", e => {
    const g = e.target.closest("[data-go]");

    if (g) {
        return go(g.dataset.go);
    }

    const b = e.target.closest("[data-act]");

    if (!b || !me) {
        return;
    }

    const id = Number(b.dataset.id);
    const t = b.dataset.t;

    switch (b.dataset.act) {
        case "apply":
            return applyForm();

        case "review":
            return isAdmin()
                ? reviewForm(id, b.dataset.decision)
                : null;

        case "cancel":
            if (confirm("Cancel this leave request?")) {
                const result = Store.update("leave_requests", id, {
                    status: "Cancelled"
                });

                if (result) {
                    toast("Request cancelled.", "info");
                    render();
                }
            }
            return;

        case "export":
            return isAdmin() ? exportCSV() : null;

        case "add":
            return isAdmin() ? crudForm(t) : null;

        case "edit":
            return isAdmin() ? crudForm(t, id) : null;

        case "calprev":
            calDate = new Date(
                calDate.getFullYear(),
                calDate.getMonth() - 1,
                1
            );
            return render();

        case "calnext":
            calDate = new Date(
                calDate.getFullYear(),
                calDate.getMonth() + 1,
                1
            );
            return render();

        case "caltoday":
            calDate = new Date();
            return render();

        case "delete": {
            if (!isAdmin()) return;

            const record = Store.find(t, id);

            if (!record) {
                return toast("Record not found.", "err");
            }

            const why = CRUD[t].blocked(record);

            if (why) {
                return toast(why, "err");
            }

            if (confirm("Delete this record permanently?")) {
                const result = Store.remove(t, id);

                if (result) {
                    toast("Record deleted.", "info");
                    render();
                }
            }
            return;
        }
    }
});


/* ================= SEARCH ================= */

document.addEventListener("input", e => {
    if (e.target.id !== "searchBox") {
        return;
    }

    q = e.target.value;

    const p = e.target.selectionStart;

    render();

    const s = $("searchBox");

    if (s) {
        s.focus();
        s.setSelectionRange(p, p);
    }
});


/* ================= FILTERS ================= */

document.addEventListener("change", e => {
    const k = e.target.dataset && e.target.dataset.filter;

    if (!k) {
        return;
    }

    const handlers = {
        status: v => fStatus = v,
        type: v => fType = v,
        dept: v => fDept = v,
        role: v => fRole = v
    };

    if (handlers[k]) {
        handlers[k](e.target.value);
        render();
    }
});


/* ================= START APPLICATION ================= */

if (me) {
    $("menuBtn").innerHTML = icon("menu");
    $("bellIcon").innerHTML = icon("bell");

    $("logoutBtn").innerHTML =
        icon("logout", 19) + "<span>Sign out</span>";

    $("topDate").textContent =
        new Date().toLocaleDateString("en-IN", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric"
        });

    $("menuBtn").onclick = () => {
        $("sidebar").classList.toggle("open");
        $("scrim").classList.toggle("show");
    };

    $("scrim").onclick = () => {
        $("sidebar").classList.remove("open");
        $("scrim").classList.remove("show");
    };

    $("logoutBtn").onclick = () => {
        Auth.logout();
    };

    $("bellBtn").onclick = openBell;

    $("avatarBtn").onclick = () => go("profile");

    if (isAdmin()) {
        $("footRight").innerHTML = `
            <button class="link" id="resetDemo">
                Reset demo data
            </button>
        `;

        $("resetDemo").onclick = () => {
            alert("Database reset is disabled to protect your MySQL data.");
        };
    }

    page = location.hash.slice(1) || "dashboard";

    lastUnread = myNotes().filter(n => !n.is_read).length;

    render(true);
}
