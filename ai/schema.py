"""
Database schema used by QueryBridge for SQL generation.

This file contains the complete database knowledge that is injected into
the LLM prompt.
"""

DB_SCHEMA = """
Database Name:
nach_apbs

Schemas:
- public
- register

========================================================
TABLE: beneficiary_list
========================================================
Primary Key:
- sl

Columns:
- sl
- ben_name
- father_name
- mobile
- memberid
- bankac
- bankname
- ifsc
- amount
- scheme_code
- scheme_id
- batchid
- is_anyerror
- error_reason
- create_notepad
- valid_dbtswitch_reside
- entry_datetime
- fy
- installment
- app_userid
- uid

========================================================
TABLE: requestlog
========================================================
Primary Key:
- sl

Columns:
- batchid
- total_beneficiary_count
- total_transaction_amount
- scheme_code
- scheme_id
- scheme_name
- dbt_type
- reference_date
- remarks
- full_req
- initial_status
- response_status
- response_time
- app_userid
- fy
- installment

========================================================
TABLE: apbs_input_headers
========================================================

Primary Key:
- slno

Columns:
- apbs_transaction_code
- usernumber
- user_name
- user_reference
- sponsor_bank_ifsc_micr_inn
- users_bank_acc
- total_items
- total_amount_in_paisa
- settlementdate
- apbs_file_number
- batchid
- inp_file_name

========================================================
TABLE: apbs_input_records
========================================================

Primary Key:
- slno

Columns:
- destination_bank_iin
- destination_account_type
- beneficiary_aadhaar_number
- beneficiary_name
- sponsor_bank_ifsc_micr_inn
- user_number
- user_reference
- amount
- batchid
- app_userid
- fy
- installment
- scheme_code
- scheme_id

========================================================
TABLE: apbs_response_headers
========================================================

Primary Key:
- slno

Columns:
- apbs_transaction_code
- usernumber
- user_name
- user_reference
- apbs_file_number
- total_items
- total_amount_in_paisa
- settlementdate
- batchid
- inp_file_name

========================================================
TABLE: apbs_response_records
========================================================

Primary Key:
- slno

Columns:
- beneficiary_name
- beneficiary_aadhaar
- beneficiary_bank_account_num
- destination_bank_iin
- user_credit_reference
- reserved_flag_status
- reserved_reason_code
- amount
- batchid
- app_userid
- scheme_code
- scheme_id
- fy
- installment

========================================================
TABLE: app_registration
========================================================

Primary Key:
- app_userid

Columns:
- app_userid
- deptid
- deptname
- application_name
- request_endpoint_url
- response_endpoint_url

========================================================
TABLE: upload_file_path
========================================================

Primary Key:
- sl

Columns:
- batchid
- inp_file_name
- res_file_name
- file_raw_upload_path
- file_inp_upload_path
- file_res_upload_path
- ack_status
- response_sent_to_client
- app_userid

========================================================
MASTER TABLES
========================================================

master_iin_numbers
master_nach_details
master_reason_code
master_usernumber_schemecode
dept_master
login_log
master_sponsor_bank_details
master_sponsorbank_log_details
sign_up

========================================================
IMPORTANT RELATIONSHIPS
========================================================

beneficiary_list.batchid
    ↔ requestlog.batchid

beneficiary_list.batchid
    ↔ apbs_input_headers.batchid

beneficiary_list.batchid
    ↔ apbs_response_headers.batchid

beneficiary_list.batchid
    ↔ apbs_response_records.batchid

beneficiary_list.memberid
    ↔ apbs_response_records.user_credit_reference

requestlog.app_userid
    ↔ app_registration.app_userid

apbs_input_records.app_userid
    ↔ app_registration.app_userid

apbs_response_records.app_userid
    ↔ app_registration.app_userid

apbs_response_records.destination_bank_iin
    ↔ master_iin_numbers.iin

apbs_response_records.reserved_reason_code
    ↔ master_reason_code.reason_code

apbs_input_records.scheme_code
    ↔ master_usernumber_schemecode.scheme_code

upload_file_path.batchid
    ↔ requestlog.batchid

========================================================
BUSINESS RULES
========================================================

- Generate PostgreSQL SQL only.
- Use JOIN whenever related tables are required.
- Prefer INNER JOIN unless LEFT JOIN is needed.
- Use aliases for readability.
- Never assume nonexistent columns.
- Never invent table names.
"""