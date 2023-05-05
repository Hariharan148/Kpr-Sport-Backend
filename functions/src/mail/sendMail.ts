import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
const Mailjet = require('node-mailjet');



admin.initializeApp();

const mailjet = new Mailjet({
  apiKey :"727bc250cbcfd76fca203c7976400c07",
  apiSecret : "f71a9adc1dc0b2fc49a8788f53b4c0ef"
});


export const checkAttendance = functions.pubsub
  .schedule('0 12 * * *')
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    try {
      const today = new Date().toISOString().slice(0, 10);

      const studentEmails = new Map();

      const promises = [];

      const studentDocId: string[] = [];

      console.log('hell', today);

      const attendanceQuerySnapshot = await admin
        .firestore()
        .collection('attendance')
        .where('date', '==', today)
        .get();

      if (attendanceQuerySnapshot.docs.length <= 0) {
        return;
      }

      const attendanceDoc = attendanceQuerySnapshot.docs[0];
      console.log(attendanceDoc);

      const studentsQuerySnapshot = await attendanceDoc.ref
        .collection('students')
        .get();

      studentsQuerySnapshot.forEach((studentDoc) => {
        const isAbsent = studentDoc.data().attendanceStatus === false;
        if (isAbsent) {
          studentDocId.push(studentDoc.id);
        }
      });

      console.log(studentDocId);

      const studentsCollectionRef = admin.firestore().collection('students');

      if (studentDocId.length === 0) {
        return;
      }

      const matchingStudentsQuerySnapshot = await studentsCollectionRef
        .where('id', 'in', studentDocId)
        .get();
      console.log('students', matchingStudentsQuerySnapshot);
      matchingStudentsQuerySnapshot.forEach((studentDoc) => {
        const emailInfo = {
          name: studentDoc.data().name,
          email: studentDoc.data().email,
          parentEmail: studentDoc.data().parentEmail,
        };
        studentEmails.set(studentDoc.id, emailInfo);
      });

      console.log('email', studentEmails);

      const documentRef = admin
        .firestore()
        .collection('extras')
        .doc('RjQ52abKy4v1yCa16nSD');
      let name;
      const doc = await documentRef.get();
      if (doc.exists) {
        name = doc.data()?.name;
        console.log(name);
      } else {
        console.log('No such document!');
      }

      for (const studentDocId of studentEmails.keys()) {
        const emailInfo = studentEmails.get(studentDocId);
        console.log('in', studentDocId);

        if (emailInfo) {
          const studentName = emailInfo.name;
          const studentEmail = emailInfo.email;
          const parentEmail = emailInfo.parentEmail;
        
            promises.push(mailjet.post('send', {'version': 'v3.1'}).request({
              'Messages': [{
                'From': {
                  'Email': 'kprsportapp@gmail.com',
                  'Name': "KprSport"
                },
                'To': [
                  {
                    'Email': studentEmail,
                    'Name': studentName
                  },
                  {
                    'Email': parentEmail
                  }
                ],
                'Subject': 'Missed Sports Training',
                'TextPart': `Dear ${studentName},\n\nYou missed our sports training session today. Regular attendance is important for our team's success. Please let us know if we can support you in attending future sessions.\n\nBest regards,\nKprSport`,
              }]
            }));


      }
    }
  }
  catch (err) {
  console.log(err);
  }
}
);
