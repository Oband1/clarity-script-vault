;; ScriptVault - Secure storage for scripts and intellectual property

;; Constants 
(define-constant contract-owner tx-sender)
(define-constant err-not-found (err u404))
(define-constant err-unauthorized (err u401))
(define-constant err-already-exists (err u409))
(define-constant err-invalid-version (err u400))

;; Data structures
(define-map scripts 
    { script-id: uint }
    {
        owner: principal,
        hash: (buff 32),
        title: (string-utf8 256),
        timestamp: uint,
        description: (string-utf8 1024),
        current-version: uint
    })

(define-map script-versions
    { script-id: uint, version: uint }
    {
        hash: (buff 32),
        changelog: (string-utf8 1024),
        timestamp: uint
    })

(define-map access-rights
    { script-id: uint, user: principal }
    { can-access: bool })

(define-map script-history
    { script-id: uint, entry-id: uint }
    {
        action: (string-utf8 64),
        performer: principal,
        timestamp: uint
    })

;; Data vars
(define-data-var last-script-id uint u0)
(define-data-var last-history-id uint u0)

;; Private functions
(define-private (is-owner (script-id uint))
    (let ((script-data (unwrap! (map-get? scripts {script-id: script-id}) false)))
        (is-eq (get owner script-data) tx-sender)))

;; Public functions
(define-public (register-script (title (string-utf8 256)) (hash (buff 32)) (description (string-utf8 1024)))
    (let 
        ((new-id (+ (var-get last-script-id) u1)))
        (begin
            (asserts! (is-none (map-get? scripts {script-id: new-id})) err-already-exists)
            (map-set scripts
                {script-id: new-id}
                {
                    owner: tx-sender,
                    hash: hash,
                    title: title,
                    timestamp: block-height,
                    description: description,
                    current-version: u1
                }
            )
            (map-set script-versions
                {script-id: new-id, version: u1}
                {
                    hash: hash,
                    changelog: "Initial version",
                    timestamp: block-height
                }
            )
            (var-set last-script-id new-id)
            (add-history new-id "REGISTER" tx-sender)
            (ok new-id))))

(define-public (update-script (script-id uint) (new-hash (buff 32)) (changelog (string-utf8 1024)))
    (let ((script (unwrap! (map-get? scripts {script-id: script-id}) err-not-found))
          (new-version (+ (get current-version script) u1)))
        (begin
            (asserts! (is-owner script-id) err-unauthorized)
            (map-set script-versions
                {script-id: script-id, version: new-version}
                {
                    hash: new-hash,
                    changelog: changelog,
                    timestamp: block-height
                }
            )
            (try! (modify-script script-id {hash: new-hash, current-version: new-version}))
            (add-history script-id "UPDATE" tx-sender)
            (ok new-version))))

(define-public (grant-access (script-id uint) (user principal))
    (begin
        (asserts! (is-owner script-id) err-unauthorized)  
        (map-set access-rights
            {script-id: script-id, user: user}
            {can-access: true}
        )
        (add-history script-id "GRANT_ACCESS" user)
        (ok true)))

(define-public (revoke-access (script-id uint) (user principal))
    (begin
        (asserts! (is-owner script-id) err-unauthorized)
        (map-delete access-rights {script-id: script-id, user: user})
        (add-history script-id "REVOKE_ACCESS" user) 
        (ok true)))

(define-public (transfer-ownership (script-id uint) (new-owner principal))
    (begin
        (asserts! (is-owner script-id) err-unauthorized)
        (try! (modify-script script-id {owner: new-owner}))
        (add-history script-id "TRANSFER_OWNERSHIP" new-owner)
        (ok true)))

;; Read only functions
(define-read-only (get-script (script-id uint))
    (map-get? scripts {script-id: script-id}))

(define-read-only (get-script-version (script-id uint) (version uint))
    (map-get? script-versions {script-id: script-id, version: version}))

(define-read-only (can-access (script-id uint) (user principal))
    (let ((access (map-get? access-rights {script-id: script-id, user: user})))
        (if (is-some access)
            (get can-access (unwrap-panic access))
            false)))

;; Helper functions
(define-private (modify-script (script-id uint) (updates {owner: principal}))
    (let ((script (unwrap! (map-get? scripts {script-id: script-id}) err-not-found)))
        (begin
            (map-set scripts
                {script-id: script-id}
                (merge script updates))
            (ok true))))

(define-private (add-history (script-id uint) (action (string-utf8 64)) (affected principal))
    (let ((entry-id (+ (var-get last-history-id) u1)))
        (begin
            (map-set script-history
                {script-id: script-id, entry-id: entry-id}
                {
                    action: action,
                    performer: tx-sender,
                    timestamp: block-height
                })
            (var-set last-history-id entry-id)
            true)))
